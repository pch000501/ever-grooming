import { createSign } from 'node:crypto'
import { SolapiMessageService } from 'solapi'

const SHEET_NAMES = {
  customers: 'CUSTOMERS',
  dogs: 'DOGS',
  reservations: 'RESERVATIONS',
  groomingStatus: 'GROOMING_STATUS',
  statusLog: 'STATUS_LOG',
  statusCodes: 'STATUS_CODES',
  designers: 'DESIGNERS',
}

const FALLBACK_STATUS_CODES = {
  '-1': '방문 대기 중',
  0: '목욕 준비 중',
  1: '목욕 중',
  2: '추가 케어 중',
  3: '미용 중',
  4: '미용 완료',
  5: '픽업 대기 중',
  6: '데이케어 중',
  7: '픽업 완료',
}

const STATUS_STARTED_COLUMNS = {
  1: 'bath_started_at',
  2: 'extra_care_started_at',
  3: 'grooming_started_at',
  4: 'completed_at',
  5: 'pickup_waiting_at',
  6: 'daycare_started_at',
  7: 'picked_up_at',
}

const STATUS_KEYS = {
  '-1': 'visit_waiting',
  0: 'bath_ready',
  1: 'bath',
  2: 'extra_care',
  3: 'grooming',
  4: 'completed',
  5: 'pickup_waiting',
  6: 'daycare',
  7: 'picked_up',
}

const BREED_PHOTOS = [
  {
    match: '푸들',
    url: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=600&q=80',
  },
  {
    match: '말티즈',
    url: 'https://images.pexels.com/photos/6784803/pexels-photo-6784803.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    match: '포메',
    url: 'https://images.pexels.com/photos/14973510/pexels-photo-14973510.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    match: '비숑',
    url: 'https://images.pexels.com/photos/15845917/pexels-photo-15845917.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
]

const DEFAULT_DOG_PHOTO =
  'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=600&q=80'

const json_headers = {
  'Content-Type': 'application/json; charset=utf-8',
}

function json_response(statusCode, body) {
  return {
    statusCode,
    headers: json_headers,
    body: JSON.stringify(body),
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function get_private_key() {
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function assert_google_env() {
  const missing = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
  ].filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`)
  }
}

function create_jwt() {
  const now = Math.floor(Date.now() / 1000)
  const unsigned_token = `${base64url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )}.${base64url(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )}`
  const signature = createSign('RSA-SHA256')
    .update(unsigned_token)
    .sign(get_private_key())

  return `${unsigned_token}.${base64url(signature)}`
}

async function get_access_token() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: create_jwt(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Google auth failed: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}

async function sheets_request(path, options = {}) {
  const access_token = await get_access_token()
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
  )

  if (!response.ok) {
    const error_text = await response.text()
    throw new Error(`Sheets request failed: ${response.status} ${error_text}`)
  }

  return response.json()
}

function rows_to_objects(values = []) {
  const [headers = [], ...rows] = values

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) =>
      headers.reduce((object, header, index) => {
        object[header] = row[index] ?? ''
        return object
      }, {}),
    )
}

function parse_bool(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === '1'
}

function normalize_phone(value) {
  const phone = String(value ?? '').replace(/\D/g, '')

  if (phone.length === 10 && phone.startsWith('10')) {
    return `0${phone}`
  }

  return phone
}

function normalize_phone_for_compare(value) {
  return normalize_phone(value).replace(/\D/g, '')
}

function parse_status_code(value, fallback = -1) {
  const code = Number(value)

  return Number.isNaN(code) ? fallback : code
}

function parse_list(value) {
  if (!value) return []

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parse_active_designers(values) {
  return rows_to_objects(values)
    .filter((designer) => parse_bool(designer.active))
    .map((designer) => ({
      id: designer.designer_id,
      name: designer.designer_name,
      position: designer.position,
      specialty: designer.specialty,
      profile_image: designer.profile_image,
    }))
}

function to_time(value) {
  if (!value) return ''

  const match = String(value).match(/(\d{1,2}):(\d{2})/)
  if (!match) return String(value)

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function get_korea_timestamp() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

function get_photo_url(breed) {
  return BREED_PHOTOS.find((photo) => breed?.includes(photo.match))?.url ?? DEFAULT_DOG_PHOTO
}

function get_status_codes(rows) {
  const sheet_codes = rows_to_objects(rows).reduce((codes, row) => {
    codes[String(row.status_code)] = row.status_label
    return codes
  }, {})

  return {
    ...FALLBACK_STATUS_CODES,
    ...sheet_codes,
    '-1': FALLBACK_STATUS_CODES['-1'],
  }
}

function find_by(items, key, value) {
  return items.find((item) => item[key] === value)
}

function require_solapi_env() {
  const missing = [
    'SOLAPI_API_KEY',
    'SOLAPI_API_SECRET',
    'SOLAPI_FROM',
    'SOLAPI_PFID',
    'SOLAPI_TEMPLATE_ID',
  ].filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing Solapi env vars: ${missing.join(', ')}`)
  }
}

function get_status_page_host() {
  const base_url =
    process.env.STATUS_PAGE_BASE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL

  if (!base_url) {
    throw new Error('Missing STATUS_PAGE_BASE_URL or Netlify URL env var')
  }

  return base_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function get_solapi_link_variable_name() {
  const name = process.env.SOLAPI_STATUS_LINK_VARIABLE || 'LINK'

  if (name.startsWith('#{') && name.endsWith('}')) {
    return name
  }

  return `#{${name}}`
}

function get_age(birth_year) {
  const year = Number(birth_year)
  if (!year) return ''

  return `${new Date().getFullYear() - year}살`
}

function build_timeline(status, reservation) {
  const entries = [{ code: -1, time: to_time(reservation.reservation_time) }]

  Object.entries(STATUS_STARTED_COLUMNS).forEach(([code, column]) => {
    if (status[column]) {
      entries.push({ code: Number(code), time: to_time(status[column]) })
    }
  })

  return entries
}

function get_current_status_code(status, reservation) {
  if (reservation.reservation_status === 'reserved') return -1

  return Number(status?.current_status_code ?? -1)
}

function normalize_sheet_data(sheet_data) {
  const customers = rows_to_objects(sheet_data.valueRanges[0]?.values).map(
    (customer) => ({
      id: customer.customer_id,
      name: customer.customer_name,
      phone: customer.phone,
      preferred_contact: parse_bool(customer.kakao_opt_in) ? '카카오톡' : '전화',
      visit_count: customer.visit_count,
      customer_note: customer.customer_note,
    }),
  )
  const dogs = rows_to_objects(sheet_data.valueRanges[1]?.values).map((dog) => ({
    id: dog.dog_id,
    customer_id: dog.customer_id,
    name: dog.dog_name,
    breed: dog.breed,
    age: get_age(dog.birth_year),
    weight: `${dog.weight}kg`,
    gender: dog.gender,
    temperament: dog.personality,
    allergies: dog.allergy,
    skin_condition: dog.skin_condition,
    dog_note: dog.dog_note,
    photo_url: get_photo_url(dog.breed),
  }))
  const raw_reservations = rows_to_objects(sheet_data.valueRanges[2]?.values)
  const raw_statuses = rows_to_objects(sheet_data.valueRanges[3]?.values)
  const raw_designers = sheet_data.valueRanges[6]?.values
  const designers = rows_to_objects(raw_designers)

  const reservations = raw_reservations.map((reservation) => {
    const status = find_by(raw_statuses, 'reservation_id', reservation.reservation_id) ?? {}
    const designer = find_by(designers, 'designer_id', reservation.designer_id)

    return {
      id: reservation.reservation_id,
      customer_id: reservation.customer_id,
      dog_id: reservation.dog_id,
      date: reservation.reservation_date,
      check_in_time: to_time(reservation.reservation_time),
      service: reservation.service_type,
      add_ons: parse_list(reservation.additional_service),
      groomer:
        designer?.designer_name ??
        (reservation.designer_id === 'designer_recommendation'
          ? '디자이너 추천'
          : reservation.designer_id),
      pickup_time: to_time(status.pickup_time || status.estimated_end_time),
      internal_note: status.internal_memo || reservation.consultation_note,
      daycare_requested: parse_bool(status.daycare_enabled),
      reservation_status: reservation.reservation_status,
      consultation_note: reservation.consultation_note,
    }
  })

  const groomingStatus = raw_statuses.map((status) => {
    const reservation = find_by(
      raw_reservations,
      'reservation_id',
      status.reservation_id,
    )
    const current_code = get_current_status_code(status, reservation ?? {})

    return {
      reservation_id: status.reservation_id,
      current_code,
      updated_at: to_time(status.updated_at),
      timeline: build_timeline(status, reservation ?? {}),
    }
  })

  return {
    customers,
    dogs,
    reservations,
    groomingStatus,
    statusCodes: get_status_codes(sheet_data.valueRanges[5]?.values),
    designers: parse_active_designers(raw_designers),
  }
}

async function get_sheet_data() {
  const params = new URLSearchParams()

  Object.values(SHEET_NAMES).forEach((sheet_name) => {
    params.append('ranges', `${sheet_name}!A:Z`)
  })
  params.set('majorDimension', 'ROWS')

  const sheet_data = await sheets_request(`/values:batchGet?${params}`)
  return normalize_sheet_data(sheet_data)
}

async function get_sheet_rows(sheet_name) {
  const data = await sheets_request(`/values/${sheet_name}!A:Z`)
  return data.values ?? []
}

function find_column(headers, key) {
  const index = headers.indexOf(key)

  if (index === -1) {
    throw new Error(`Column "${key}" not found`)
  }

  return index
}

function column_letter(index) {
  let column = ''
  let number = index + 1

  while (number > 0) {
    const remainder = (number - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    number = Math.floor((number - 1) / 26)
  }

  return column
}

function get_next_id(rows, id_column_name, prefix, width = 3) {
  const headers = rows[0] ?? []
  const id_column = find_column(headers, id_column_name)
  const max_number = rows.slice(1).reduce((max, row) => {
    const value = row[id_column] ?? ''
    const match = String(value).match(/(\d+)$/)
    const number = match ? Number(match[1]) : 0

    return Number.isNaN(number) ? max : Math.max(max, number)
  }, 0)

  return `${prefix}${String(max_number + 1).padStart(width, '0')}`
}

function row_from_fields(headers, fields) {
  return headers.map((header) => fields[header] ?? '')
}

async function update_cell(sheet_name, row_number, column_index, value) {
  const range = `${sheet_name}!${column_letter(column_index)}${row_number}`

  await sheets_request(`/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [[value]],
    }),
  })
}

async function append_row(sheet_name, values) {
  await sheets_request(
    `/values/${sheet_name}!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [values],
      }),
    },
  )
}

async function update_cells(sheet_name, row_number, fields) {
  const rows = await get_sheet_rows(sheet_name)
  const headers = rows[0] ?? []

  await Promise.all(
    Object.entries(fields).map(([key, value]) =>
      update_cell(sheet_name, row_number, find_column(headers, key), value),
    ),
  )
}

async function create_reservation(payload) {
  const customer_name = String(payload.customer_name ?? '').trim()
  const dog_name = String(payload.dog_name ?? '').trim()
  const phone = normalize_phone(payload.phone)
  const reservation_date = String(payload.reservation_date ?? '').trim()
  const reservation_time = to_time(payload.reservation_time)
  const designer_id = String(payload.designer_id ?? '').trim()
  const service_type = String(payload.service_type ?? '').trim()

  if (!customer_name) {
    throw new Error('customer_name is required')
  }

  if (!phone) {
    throw new Error('phone is required')
  }

  if (!dog_name) {
    throw new Error('dog_name is required')
  }

  if (!reservation_date) {
    throw new Error('reservation_date is required')
  }

  if (!reservation_time) {
    throw new Error('reservation_time is required')
  }

  if (!designer_id) {
    throw new Error('designer_id is required')
  }

  if (!service_type) {
    throw new Error('service_type is required')
  }

  const [customer_rows, dog_rows, reservation_rows] = await Promise.all([
    get_sheet_rows(SHEET_NAMES.customers),
    get_sheet_rows(SHEET_NAMES.dogs),
    get_sheet_rows(SHEET_NAMES.reservations),
  ])
  const customer_headers = customer_rows[0] ?? []
  const dog_headers = dog_rows[0] ?? []
  const reservation_headers = reservation_rows[0] ?? []
  const phone_column = find_column(customer_headers, 'phone')
  const customer_id_column = find_column(customer_headers, 'customer_id')
  const visit_count_column = find_column(customer_headers, 'visit_count')
  const matched_customer_index = customer_rows.findIndex((row, index) => {
    return (
      index > 0 &&
      normalize_phone_for_compare(row[phone_column]) ===
        normalize_phone_for_compare(phone)
    )
  })
  const created_at = get_korea_timestamp()
  let customer_id

  if (matched_customer_index === -1) {
    customer_id = get_next_id(customer_rows, 'customer_id', 'cus_')

    await append_row(
      SHEET_NAMES.customers,
      row_from_fields(customer_headers, {
        customer_id,
        customer_name,
        phone,
        visit_count: '1',
        created_at,
      }),
    )
  } else {
    const customer_row = customer_rows[matched_customer_index]
    const row_number = matched_customer_index + 1
    const visit_count = Number(customer_row[visit_count_column] ?? 0)

    customer_id = customer_row[customer_id_column]

    await update_cell(
      SHEET_NAMES.customers,
      row_number,
      visit_count_column,
      String((Number.isNaN(visit_count) ? 0 : visit_count) + 1),
    )
  }

  const dog_id = get_next_id(dog_rows, 'dog_id', 'dog_')
  const reservation_id = get_next_id(reservation_rows, 'reservation_id', 'res_')

  await append_row(
    SHEET_NAMES.dogs,
    row_from_fields(dog_headers, {
      dog_id,
      customer_id,
      dog_name,
      created_at,
    }),
  )

  await append_row(
    SHEET_NAMES.reservations,
    row_from_fields(reservation_headers, {
      reservation_id,
      customer_id,
      dog_id,
      reservation_date,
      reservation_time,
      designer_id,
      service_type,
      reservation_channel: '네이버',
      reservation_status: 'reserved',
      created_at,
    }),
  )

  return {
    reservation_id,
    customer_id,
    dog_id,
  }
}

async function get_row_by_id(sheet_name, id_column_name, id) {
  const rows = await get_sheet_rows(sheet_name)
  const headers = rows[0] ?? []
  const id_column = find_column(headers, id_column_name)
  const row_index = rows.findIndex((row, index) => {
    return index > 0 && row[id_column] === id
  })

  if (row_index === -1) {
    throw new Error(`${sheet_name} row "${id}" not found`)
  }

  return {
    headers,
    row: rows[row_index],
    row_number: row_index + 1,
  }
}

async function find_row_number(sheet_name, id_column_name, id) {
  const row_data = await get_row_by_id(sheet_name, id_column_name, id)
  return row_data.row_number
}

async function update_reservation_fields(reservation_id, fields) {
  const row_number = await find_row_number(
    SHEET_NAMES.groomingStatus,
    'reservation_id',
    reservation_id,
  )
  const updates = {}

  if (Object.hasOwn(fields, 'internal_note')) {
    updates.internal_memo = fields.internal_note
  }

  if (Object.hasOwn(fields, 'daycare_requested')) {
    updates.daycare_enabled = fields.daycare_requested ? 'TRUE' : 'FALSE'
  }

  if (Object.keys(updates).length > 0) {
    await update_cells(SHEET_NAMES.groomingStatus, row_number, updates)
  }
}

async function append_status_log(reservation_id, status_payload, previous_code) {
  const changed_at = status_payload.changed_at ?? get_korea_timestamp()
  const current_code = Number(status_payload.current_code)

  await append_row(SHEET_NAMES.statusLog, [
    `log_${Date.now()}`,
    reservation_id,
    STATUS_KEYS[previous_code] ?? String(previous_code),
    STATUS_KEYS[current_code] ?? String(current_code),
    changed_at,
    status_payload.changed_by || '관리자',
  ])
}

async function update_grooming_status(reservation_id, status_payload) {
  const status_row_data = await get_row_by_id(
    SHEET_NAMES.groomingStatus,
    'reservation_id',
    reservation_id,
  )
  const reservation_row_number = await find_row_number(
    SHEET_NAMES.reservations,
    'reservation_id',
    reservation_id,
  )
  const current_status_column = find_column(
    status_row_data.headers,
    'current_status_code',
  )
  const previous_code = parse_status_code(
    status_row_data.row[current_status_column],
    parse_status_code(status_payload.previous_code),
  )
  const current_code = parse_status_code(status_payload.current_code, previous_code)
  const updated_at = get_korea_timestamp()
  const fields = {
    current_status_code: String(current_code),
    current_status_label:
      FALLBACK_STATUS_CODES[String(current_code)] ?? String(current_code),
    updated_at,
  }
  const started_column = STATUS_STARTED_COLUMNS[current_code]

  if (started_column) {
    fields[started_column] = updated_at
  }

  await Promise.all([
    update_cells(SHEET_NAMES.groomingStatus, status_row_data.row_number, fields),
    update_cells(SHEET_NAMES.reservations, reservation_row_number, {
      reservation_status: current_code < 0 ? 'reserved' : 'in_progress',
    }),
    append_status_log(
      reservation_id,
      {
        ...status_payload,
        updated_at,
        changed_at: updated_at,
      },
      previous_code,
    ),
  ])
}

function build_status_page_link(reservation_id) {
  return `${get_status_page_host()}/status/${reservation_id}`
}

function build_kakao_variables(dog, reservation_id) {
  return {
    '#{강아지명}': dog.dog_name,
    [get_solapi_link_variable_name()]: build_status_page_link(reservation_id),
  }
}

async function send_kakao_status_message(reservation_id, payload = {}) {
  require_solapi_env()

  const [reservation_rows, customer_rows, dog_rows, status_rows] =
    await Promise.all([
      get_sheet_rows(SHEET_NAMES.reservations),
      get_sheet_rows(SHEET_NAMES.customers),
      get_sheet_rows(SHEET_NAMES.dogs),
      get_sheet_rows(SHEET_NAMES.groomingStatus),
    ])
  const reservations = rows_to_objects(reservation_rows)
  const customers = rows_to_objects(customer_rows)
  const dogs = rows_to_objects(dog_rows)
  const statuses = rows_to_objects(status_rows)
  const reservation = find_by(reservations, 'reservation_id', reservation_id)

  if (!reservation) {
    throw new Error(`Reservation "${reservation_id}" not found`)
  }

  const customer = find_by(customers, 'customer_id', reservation.customer_id)
  const dog = find_by(dogs, 'dog_id', reservation.dog_id)
  const status = find_by(statuses, 'reservation_id', reservation_id) ?? {}

  if (!customer) {
    throw new Error(`Customer "${reservation.customer_id}" not found`)
  }

  if (!dog) {
    throw new Error(`Dog "${reservation.dog_id}" not found`)
  }

  const to = normalize_phone(customer.phone)
  const from = normalize_phone(process.env.SOLAPI_FROM)

  if (!to) {
    throw new Error(`Customer "${customer.customer_id}" has no phone number`)
  }

  if (!from) {
    throw new Error('SOLAPI_FROM is empty or invalid')
  }

  const status_label =
    payload.status_label ||
    status.current_status_label ||
    FALLBACK_STATUS_CODES[String(status.current_status_code)] ||
    ''
  const messageService = new SolapiMessageService(
    process.env.SOLAPI_API_KEY,
    process.env.SOLAPI_API_SECRET,
  )
  const result = await messageService.send({
    to,
    from,
    kakaoOptions: {
      pfId: process.env.SOLAPI_PFID,
      templateId: process.env.SOLAPI_TEMPLATE_ID,
      variables: build_kakao_variables(dog, reservation_id),
      disableSms: process.env.SOLAPI_DISABLE_SMS !== 'false',
    },
  })

  return {
    result,
    sent_to: to,
    status_label,
  }
}

export async function handler(event) {
  try {
    assert_google_env()

    if (event.httpMethod === 'GET') {
      return json_response(200, await get_sheet_data())
    }

    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body || '{}')

      if (!body.reservation_id) {
        return json_response(400, { message: 'reservation_id is required' })
      }

      if (body.type === 'status') {
        await update_grooming_status(body.reservation_id, body.payload)
      }

      if (body.type === 'reservation') {
        await update_reservation_fields(body.reservation_id, body.payload)
      }

      if (body.type === 'kakao_status') {
        const result = await send_kakao_status_message(
          body.reservation_id,
          body.payload,
        )

        return json_response(200, {
          ok: true,
          message: 'Kakao status message sent',
          result,
        })
      }

      return json_response(200, await get_sheet_data())
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')

      if (body.type !== 'create_reservation') {
        return json_response(400, { message: 'Unsupported POST type' })
      }

      await create_reservation(body.payload ?? {})

      return json_response(201, await get_sheet_data())
    }

    return json_response(405, { message: 'Method not allowed' })
  } catch (error) {
    console.error('reservations function failed', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })

    return json_response(500, {
      name: error.name,
      message: error.message,
    })
  }
}
