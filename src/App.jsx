import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom'
import {
  customers as mock_customers,
  designers as mock_designers,
  dogs as mock_dogs,
  groomingStatus as mock_grooming_status,
  reservations as mock_reservations,
  statusCodes,
} from './mockData'
import './App.css'

const API_URL = '/api/reservations'

const status_entries = Object.entries(statusCodes).map(([code, label]) => ({
  code: Number(code),
  label,
})).sort((a, b) => a.code - b.code)

const estimated_tasks = [
  { key: 'bath', label: '목욕', minutes: 30 },
  { key: 'grooming', label: '미용', minutes: 120 },
]

const service_type_options = [
  '디자인 미용(가위컷)',
  '위생 미용',
  '클리핑',
]

const recommended_designer = {
  id: 'designer_recommendation',
  name: '디자이너 추천',
  position: '자동 배정',
  specialty: '예약 상황에 맞춰 추천',
  profile_image:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
}

const designer_profile_images = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
]

const designer_time_slots = {
  designer_recommendation: [
    '09:00',
    '10:00',
    '11:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ],
  des_001: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  des_002: ['10:00', '11:00', '12:00', '13:00', '16:00', '17:00'],
  des_003: ['09:00', '13:00', '14:00', '15:00', '17:00'],
}

function get_designer_profile_image(designer, index = 0) {
  return (
    designer.profile_image ||
    designer.profileImage ||
    designer.image_url ||
    designer.imageUrl ||
    designer_profile_images[index % designer_profile_images.length]
  )
}

function get_designer_time_slots(designer_id) {
  return designer_time_slots[designer_id] ?? designer_time_slots.designer_recommendation
}

function get_current_timestamp() {
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

function add_minutes_to_time(time, minutes) {
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hour, minute + minutes, 0, 0)

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

function get_estimated_tasks(reservation) {
  const tasks = [...estimated_tasks]

  if (reservation.add_ons.length > 0) {
    tasks.push({ key: 'add_care', label: '추가 케어', minutes: 30 })
  }

  return tasks
}

function get_total_estimated_minutes(reservation) {
  return get_estimated_tasks(reservation).reduce(
    (total, task) => total + task.minutes,
    0,
  )
}

function calculate_expected_finish_time(reservation) {
  return add_minutes_to_time(
    reservation.check_in_time,
    get_total_estimated_minutes(reservation),
  )
}

function normalize_reservation(reservation) {
  return {
    ...reservation,
    add_ons: Array.isArray(reservation.add_ons)
      ? reservation.add_ons
      : String(reservation.add_ons || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
    daycare_requested:
      reservation.daycare_requested === true ||
      reservation.daycare_requested === 'TRUE' ||
      reservation.daycare_requested === 'true',
  }
}

function normalize_status(status, reservation) {
  const fallback_code = reservation.reservation_status === 'reserved' ? -1 : 0
  const fallback_time = reservation.check_in_time

  return {
    reservation_id: status?.reservation_id ?? reservation.id,
    current_code: Number(status?.current_code ?? fallback_code),
    updated_at: status?.updated_at ?? fallback_time,
    timeline: status?.timeline ?? [{ code: fallback_code, time: fallback_time }],
  }
}

function build_reservations(data) {
  const source = data ?? {
    customers: mock_customers,
    designers: mock_designers,
    dogs: mock_dogs,
    reservations: mock_reservations,
    groomingStatus: mock_grooming_status,
  }

  return source.reservations.map((raw_reservation) => {
    const reservation = normalize_reservation(raw_reservation)
    const customer = source.customers.find(
      (item) => item.id === reservation.customer_id,
    ) ?? {
      id: reservation.customer_id,
      name: '고객 정보 없음',
      phone: '',
      preferred_contact: '',
    }
    const dog = source.dogs.find((item) => item.id === reservation.dog_id) ?? {
      id: reservation.dog_id || `${reservation.id}_dog_pending`,
      customer_id: reservation.customer_id,
      name: '반려견 미등록',
      breed: '상담 필요',
      age: '',
      weight: '',
      temperament: '',
      allergies: '',
      photo_url:
        'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=600&q=80',
    }
    const status = normalize_status(
      source.groomingStatus.find(
      (item) => item.reservation_id === reservation.id,
      ),
      reservation,
    )

    return {
      ...reservation,
      customer,
      dog,
      estimated_tasks: get_estimated_tasks(reservation),
      estimated_minutes: get_total_estimated_minutes(reservation),
      expected_finish_time: calculate_expected_finish_time(reservation),
      current_code: status.current_code,
      updated_at: status.updated_at,
      timeline: status.timeline,
    }
  })
}

async function load_reservations_from_api() {
  const response = await fetch(API_URL)

  if (!response.ok) {
    throw new Error(`API load failed: ${response.status}`)
  }

  return response.json()
}

async function patch_reservation_to_api(reservation_id, type, payload) {
  const response = await fetch(API_URL, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservation_id,
      type,
      payload,
    }),
  })

  if (!response.ok) {
    let message = `API update failed: ${response.status}`

    try {
      const data = await response.json()
      message = data.message ?? message
    } catch {
      message = await response.text()
    }

    throw new Error(message)
  }

  return response.json()
}

async function create_reservation_to_api(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'create_reservation',
      payload,
    }),
  })

  if (!response.ok) {
    let message = `API create failed: ${response.status}`

    try {
      const data = await response.json()
      message = data.message ?? message
    } catch {
      message = await response.text()
    }

    throw new Error(message)
  }

  return response.json()
}

async function send_kakao_status_message(reservation_id, payload) {
  return patch_reservation_to_api(reservation_id, 'kakao_status', payload)
}

function App() {
  const [reservation_list, set_reservation_list] = useState(build_reservations)
  const [designer_list, set_designer_list] = useState(mock_designers)
  const [data_source, set_data_source] = useState('mock')
  const [sync_message, set_sync_message] = useState('')

  useEffect(() => {
    let canceled = false

    load_reservations_from_api()
      .then((data) => {
        if (canceled) return
        set_reservation_list(build_reservations(data))
        set_designer_list(data.designers ?? [])
        set_data_source('sheets')
      })
      .catch(() => {
        if (canceled) return
        set_reservation_list(build_reservations())
        set_designer_list(mock_designers)
        set_data_source('mock')
      })

    return () => {
      canceled = true
    }
  }, [])

  const update_reservation = async (reservation_id, updater, sync_options) => {
    const current_reservation = reservation_list.find(
      (reservation) => reservation.id === reservation_id,
    )

    if (!current_reservation) return

    const updated_reservation = updater(current_reservation)

    set_reservation_list((current) =>
      current.map((reservation) =>
        reservation.id === reservation_id ? updated_reservation : reservation,
      ),
    )

    if (data_source !== 'sheets' || !sync_options) return

    try {
      set_sync_message('Google Sheets 저장 중')
      const data = await patch_reservation_to_api(
        reservation_id,
        sync_options.type,
        sync_options.payload(updated_reservation),
      )
      set_reservation_list(build_reservations(data))
      set_sync_message('Google Sheets 저장 완료')
    } catch {
      set_sync_message('Google Sheets 저장 실패')
    }
  }

  const create_reservation = async (payload) => {
    if (data_source !== 'sheets') {
      throw new Error('Google Sheets 연결 후 예약을 생성할 수 있습니다.')
    }

    set_sync_message('Google Sheets 저장 중')
    const data = await create_reservation_to_api(payload)

    set_reservation_list(build_reservations(data))
    set_designer_list(data.designers ?? [])
    set_sync_message('Google Sheets 저장 완료')

    return data
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              reservations={reservation_list}
              data_source={data_source}
              sync_message={sync_message}
            />
          }
        />
        <Route
          path="/admin"
          element={
            <AdminPage
              reservations={reservation_list}
              designers={designer_list}
              create_reservation={create_reservation}
              update_reservation={update_reservation}
              data_source={data_source}
              sync_message={sync_message}
            />
          }
        />
        <Route
          path="/status/:reservationId"
          element={
            <StatusPage
              reservations={reservation_list}
              update_reservation={update_reservation}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function HomePage({ reservations, data_source, sync_message }) {
  const grooming_reservations = reservations.filter(
    (reservation) =>
      reservation.current_code > 0 && reservation.current_code < 7,
  )
  const scheduled_reservations = reservations.filter(
    (reservation) => reservation.current_code <= 0,
  )

  return (
    <main className="home_page">
      <section className="home_top">
        <div>
          <div className="home_eyebrow">EVER Grooming Demo</div>
          <h1>오늘의 예약과 진행 현황</h1>
          <p>진행 중인 아이와 예약 대기 아이를 구분해서 선택합니다.</p>
          <DataSourceBadge
            data_source={data_source}
            sync_message={sync_message}
          />
        </div>
        <div className="home_actions">
          <Link className="primary_link" to="/admin">
            관리자 화면
          </Link>
        </div>
      </section>

      <section className="home_board">
        <ReservationGroup
          title="현재 미용 진행 중"
          description="상태가 업데이트되고 있는 오늘의 케어"
          reservations={grooming_reservations}
        />
        <ReservationGroup
          title="예약 일정"
          description="체크인 예정이거나 준비 단계인 아이"
          reservations={scheduled_reservations}
        />
      </section>
    </main>
  )
}

function ReservationGroup({ title, description, reservations }) {
  return (
    <section className="reservation_group">
      <div className="reservation_group_header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{reservations.length}건</span>
      </div>

      <div className="compact_reservation_list">
        {reservations.length > 0 ? (
          reservations.map((reservation) => (
            <Link
              className="compact_reservation_item"
              key={reservation.id}
              to={`/status/${reservation.id}`}
            >
              <img
                src={reservation.dog.photo_url}
                alt={`${reservation.dog.name}`}
              />
              <div>
                <strong>{reservation.dog.name}</strong>
                <span>{reservation.dog.breed}</span>
              </div>
              <small>{reservation.check_in_time}</small>
              <em>{statusCodes[reservation.current_code]}</em>
            </Link>
          ))
        ) : (
          <div className="empty_group">해당 아이가 없습니다.</div>
        )}
      </div>
    </section>
  )
}

function AdminPage({
  reservations,
  designers,
  create_reservation,
  update_reservation,
  data_source,
  sync_message,
}) {
  const grooming_reservations = useMemo(
    () =>
      reservations
        .filter(
          (reservation) =>
            reservation.current_code > 0 && reservation.current_code < 7,
        )
        .sort((a, b) => b.current_code - a.current_code),
    [reservations],
  )
  const scheduled_reservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.current_code <= 0)
        .sort((a, b) => a.check_in_time.localeCompare(b.check_in_time)),
    [reservations],
  )
  const default_selected_id =
    grooming_reservations[0]?.id ?? scheduled_reservations[0]?.id
  const [selected_id, set_selected_id] = useState(default_selected_id)
  const [pending_status, set_pending_status] = useState(null)
  const [message_prompt, set_message_prompt] = useState(null)
  const [message_confirm, set_message_confirm] = useState(false)
  const [message_state, set_message_state] = useState('')
  const [reservation_modal_open, set_reservation_modal_open] = useState(false)
  const [reservation_create_state, set_reservation_create_state] = useState('')
  const selected_reservation = useMemo(
    () =>
      reservations.find((reservation) => reservation.id === selected_id) ??
      reservations.find((reservation) => reservation.id === default_selected_id),
    [default_selected_id, reservations, selected_id],
  )

  const request_status_update = (target_code) => {
    set_pending_status({
      reservation: selected_reservation,
      target_code,
    })
  }

  const close_status_modal = () => {
    set_pending_status(null)
  }

  const confirm_status_update = () => {
    if (!pending_status) return

    const { reservation: pending_reservation, target_code } = pending_status
    const previous_code = pending_reservation.current_code
    const next_label = statusCodes[target_code]

    update_reservation(
      pending_reservation.id,
      (reservation) => {
        const updated_time = get_current_timestamp()
        const existing_times = new Map(
          reservation.timeline.map((item) => [item.code, item.time]),
        )

        return {
          ...reservation,
          current_code: target_code,
          updated_at: updated_time,
          timeline: status_entries
            .filter((status) => status.code <= target_code)
            .map((status) => ({
              code: status.code,
              time: existing_times.get(status.code) ?? updated_time,
            })),
        }
      },
      {
        type: 'status',
        payload: (reservation) => ({
          previous_code,
          current_code: reservation.current_code,
          updated_at: reservation.updated_at,
          timeline: reservation.timeline,
          dog_name: reservation.dog.name,
        }),
      },
    )
    close_status_modal()
    set_message_prompt({
      reservation: {
        ...pending_reservation,
        current_code: target_code,
      },
      status_label: next_label,
    })
    set_message_confirm(false)
    set_message_state('')
  }

  const close_message_prompt = () => {
    set_message_prompt(null)
    set_message_confirm(false)
    set_message_state('')
  }

  const request_message_confirm = () => {
    set_message_confirm(true)
    set_message_state('')
  }

  const confirm_message_send = async () => {
    if (!message_prompt) return

    try {
      set_message_state('전송 중')
      await send_kakao_status_message(message_prompt.reservation.id, {
        status_label: message_prompt.status_label,
      })
      set_message_state('전송 완료')
    } catch (error) {
      set_message_state(error.message || '전송 실패')
    }
  }

  const update_field = (field, value) => {
    update_reservation(
      selected_reservation.id,
      (reservation) => ({
        ...reservation,
        [field]: value,
      }),
      {
        type: 'reservation',
        payload: (reservation) => ({ [field]: reservation[field] }),
      },
    )
  }

  const open_reservation_modal = () => {
    set_reservation_create_state('')
    set_reservation_modal_open(true)
  }

  const close_reservation_modal = () => {
    set_reservation_modal_open(false)
    set_reservation_create_state('')
  }

  const submit_new_reservation = async (payload) => {
    try {
      set_reservation_create_state('예약 저장 중')
      await create_reservation(payload)
      set_reservation_create_state('예약 생성 완료')
      set_reservation_modal_open(false)
    } catch (error) {
      set_reservation_create_state(error.message || '예약 생성 실패')
    }
  }

  return (
    <main className="admin_page">
      <header className="admin_header">
        <div>
          <span className="page_label">EVER_testDB mock</span>
          <h1>오늘 진행 중인 강아지</h1>
          <DataSourceBadge
            data_source={data_source}
            sync_message={sync_message}
          />
        </div>
        <div className="admin_header_actions">
          <button
            className="primary_button header_button"
            type="button"
            onClick={open_reservation_modal}
          >
            예약 생성
          </button>
          {selected_reservation ? (
            <Link className="text_link" to={`/status/${selected_reservation.id}`}>
              고객 화면 보기
            </Link>
          ) : null}
        </div>
      </header>

      <section className="admin_layout">
        <aside className="dog_list_panel">
          <AdminReservationGroup
            title="현재 진행 중"
            count={grooming_reservations.length}
            reservations={grooming_reservations}
            selected_id={selected_reservation?.id}
            on_select={set_selected_id}
          />
          <AdminReservationGroup
            title="예약 일정"
            count={scheduled_reservations.length}
            reservations={scheduled_reservations}
            selected_id={selected_reservation?.id}
            on_select={set_selected_id}
          />
        </aside>

        {selected_reservation ? (
          <section className="detail_panel">
          <div className="detail_top">
            <img
              className="dog_photo"
              src={selected_reservation.dog.photo_url}
              alt={`${selected_reservation.dog.name}`}
            />
            <div>
              <span className="page_label">Selected dog</span>
              <h2>{selected_reservation.dog.name}</h2>
              <p>
                {selected_reservation.dog.breed} · {selected_reservation.dog.age} ·{' '}
                {selected_reservation.dog.weight}
              </p>
            </div>
            <div className="status_pill">
              {statusCodes[selected_reservation.current_code]}
            </div>
          </div>

          <div className="info_grid">
            <InfoSection title="예약 정보">
              <InfoRow label="예약 ID" value={selected_reservation.id} />
              <InfoRow label="체크인" value={selected_reservation.check_in_time} />
              <InfoRow label="서비스" value={selected_reservation.service} />
              <InfoRow
                label="추가 케어"
                value={selected_reservation.add_ons.join(', ')}
              />
              <InfoRow label="담당자" value={selected_reservation.groomer} />
            </InfoSection>

            <InfoSection title="강아지 정보">
              <InfoRow label="보호자" value={selected_reservation.customer.name} />
              <InfoRow label="연락처" value={selected_reservation.customer.phone} />
              <InfoRow
                label="성향"
                value={selected_reservation.dog.temperament}
              />
              <InfoRow
                label="알러지"
                value={selected_reservation.dog.allergies}
              />
            </InfoSection>
          </div>

          <div className="control_grid">
            <section className="control_panel">
              <h3>현재 상태</h3>
              <div className="current_status_box">
                <strong>{statusCodes[selected_reservation.current_code]}</strong>
                <span>마지막 업데이트 {selected_reservation.updated_at}</span>
              </div>
              <div className="admin_status_flow">
                {status_entries.map((status, index) => {
                  const is_current = status.code === selected_reservation.current_code
                  const is_done = status.code < selected_reservation.current_code
                  const next_status = status_entries[index + 1]

                  return (
                    <div className="admin_status_group" key={status.code}>
                      <div
                        className={`admin_status_step ${
                          is_done ? 'admin_status_step_done' : ''
                        } ${is_current ? 'admin_status_step_current' : ''}`}
                      >
                        <span>{status.code}</span>
                        <strong>{status.label}</strong>
                        {is_current ? <em>현재</em> : null}
                      </div>
                      {next_status ? (
                        <button
                          className="status_change_button"
                          type="button"
                          onClick={() => request_status_update(next_status.code)}
                          disabled={
                            next_status.code === selected_reservation.current_code
                          }
                        >
                          {next_status.label}로 변경
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="control_panel">
              <h3>예상 종료 시간</h3>
              <div className="estimate_box">
                <strong>{selected_reservation.expected_finish_time}</strong>
                <span>
                  체크인 {selected_reservation.check_in_time} 기준 · 총{' '}
                  {selected_reservation.estimated_minutes}분
                </span>
              </div>
              <div className="duration_list">
                {selected_reservation.estimated_tasks.map((task) => (
                  <div className="duration_item" key={task.key}>
                    <span>{task.label}</span>
                    <strong>{task.minutes}분</strong>
                  </div>
                ))}
              </div>
              <p>픽업 예정 {selected_reservation.pickup_time}</p>
            </section>
          </div>

          <section className="note_panel">
            <h3>내부 메모</h3>
            <textarea
              value={selected_reservation.internal_note}
              onChange={(event) =>
                update_field('internal_note', event.target.value)
              }
            />
          </section>
        </section>
        ) : (
          <section className="detail_panel empty_detail_panel">
            <span className="page_label">No reservation</span>
            <h2>오늘 예약이 없습니다.</h2>
            <p>새 예약을 생성하면 이 화면에 예약 일정이 표시됩니다.</p>
          </section>
        )}
      </section>
      {reservation_modal_open ? (
        <ReservationCreateModal
          designers={designers}
          data_source={data_source}
          create_state={reservation_create_state}
          on_cancel={close_reservation_modal}
          on_submit={submit_new_reservation}
        />
      ) : null}
      {pending_status ? (
        <StatusConfirmModal
          reservation={pending_status.reservation}
          current_label={statusCodes[pending_status.reservation.current_code]}
          next_label={statusCodes[pending_status.target_code]}
          on_cancel={close_status_modal}
          on_confirm={confirm_status_update}
        />
      ) : null}
      {message_prompt ? (
        <KakaoMessageModal
          reservation={message_prompt.reservation}
          confirming={message_confirm}
          message_state={message_state}
          on_cancel={close_message_prompt}
          on_request_confirm={request_message_confirm}
          on_confirm_send={confirm_message_send}
        />
      ) : null}
    </main>
  )
}

function ReservationCreateModal({
  designers,
  data_source,
  create_state,
  on_cancel,
  on_submit,
}) {
  const today = get_current_timestamp().slice(0, 10)
  const designer_options = [...designers, recommended_designer]
  const [step, set_step] = useState('form')
  const [form, set_form] = useState({
    customer_name: '',
    dog_name: '',
    phone: '',
    designer_id: '',
    reservation_date: today,
    reservation_time: '',
    service_type: service_type_options[0],
  })
  const selected_designer =
    designer_options.find((designer) => designer.id === form.designer_id) ?? null
  const time_options = selected_designer
    ? get_designer_time_slots(selected_designer.id)
    : []
  const can_submit =
    form.customer_name.trim() &&
    form.dog_name.trim() &&
    form.phone.trim() &&
    form.designer_id &&
    form.reservation_date &&
    form.reservation_time &&
    form.service_type
  const saving = create_state === '예약 저장 중'

  const update_form = (field, value) => {
    set_form((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const select_designer = (designer_id) => {
    const available_times = get_designer_time_slots(designer_id)

    set_form((current) => ({
      ...current,
      designer_id,
      reservation_time: available_times.includes(current.reservation_time)
        ? current.reservation_time
        : available_times[0] ?? '',
    }))
  }

  const request_confirm = (event) => {
    event.preventDefault()
    if (!can_submit) return
    set_step('confirm')
  }

  const confirm_submit = () => {
    if (!can_submit || saving) return
    on_submit({
      ...form,
      customer_name: form.customer_name.trim(),
      dog_name: form.dog_name.trim(),
      phone: form.phone.trim(),
    })
  }

  return (
    <div className="modal_backdrop" role="presentation">
      <section
        className="reservation_create_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation_create_title"
      >
        <div className="modal_header">
          <span className="page_label">New reservation</span>
          <h2 id="reservation_create_title">
            {step === 'form' ? '예약 생성' : '예약 정보 확인'}
          </h2>
        </div>

        {step === 'form' ? (
          <form className="reservation_form" onSubmit={request_confirm}>
            <div className="form_grid">
              <label>
                <span>고객님 성함</span>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(event) =>
                    update_form('customer_name', event.target.value)
                  }
                  placeholder="홍길동"
                  required
                />
              </label>
              <label>
                <span>전화번호</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update_form('phone', event.target.value)}
                  placeholder="010-0000-0000"
                  required
                />
              </label>
              <label className="form_grid_wide">
                <span>강아지 이름</span>
                <input
                  type="text"
                  value={form.dog_name}
                  onChange={(event) => update_form('dog_name', event.target.value)}
                  placeholder="모찌"
                  required
                />
              </label>
            </div>

            <section className="designer_picker">
              <div className="field_header">
                <h3>디자이너 선택</h3>
                <span>{designer_options.length}명</span>
              </div>
              <div className="designer_cards">
                {designer_options.map((designer, index) => (
                  <button
                    className={`designer_card ${
                      designer.id === form.designer_id
                        ? 'designer_card_active'
                        : ''
                    }`}
                    key={designer.id}
                    type="button"
                    onClick={() => select_designer(designer.id)}
                  >
                    <img
                      src={get_designer_profile_image(designer, index)}
                      alt=""
                    />
                    <span className="designer_card_body">
                      <strong>{designer.name}</strong>
                      <small>{designer.position}</small>
                      <span className="designer_specialty">
                        <span>전문 미용 견종</span>
                        <em>{designer.specialty}</em>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {selected_designer ? (
              <section className="schedule_picker">
                <div className="field_header">
                  <h3>예약 일자와 시간</h3>
                  <span>{selected_designer.name}</span>
                </div>
                <div className="form_grid">
                  <label>
                    <span>예약 일자</span>
                    <input
                      type="date"
                      value={form.reservation_date}
                      onChange={(event) =>
                        update_form('reservation_date', event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>예약 시간</span>
                    <select
                      value={form.reservation_time}
                      onChange={(event) =>
                        update_form('reservation_time', event.target.value)
                      }
                    >
                      {time_options.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ) : (
              <div className="schedule_placeholder">
                디자이너를 선택하면 예약 일자와 시간을 선택할 수 있습니다.
              </div>
            )}

            <section className="service_picker">
              <div className="field_header">
                <h3>미용 방식</h3>
              </div>
              <div className="service_options">
                {service_type_options.map((service_type) => (
                  <button
                    className={`service_option ${
                      service_type === form.service_type
                        ? 'service_option_active'
                        : ''
                    }`}
                    key={service_type}
                    type="button"
                    onClick={() => update_form('service_type', service_type)}
                  >
                    {service_type}
                  </button>
                ))}
              </div>
            </section>

            {data_source !== 'sheets' ? (
              <div className="message_state_box">
                Google Sheets 연결 상태에서만 예약을 저장할 수 있습니다.
              </div>
            ) : null}
            {create_state ? (
              <div className="message_state_box">{create_state}</div>
            ) : null}

            <div className="modal_actions">
              <button className="secondary_button" type="button" onClick={on_cancel}>
                취소
              </button>
              <button
                className="primary_button"
                type="submit"
                disabled={!can_submit || data_source !== 'sheets'}
              >
                정보 확인
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal_summary">
              <div>
                <span>고객명</span>
                <strong>{form.customer_name}</strong>
              </div>
              <div>
                <span>전화번호</span>
                <strong>{form.phone}</strong>
              </div>
              <div>
                <span>강아지 이름</span>
                <strong>{form.dog_name}</strong>
              </div>
              <div>
                <span>디자이너</span>
                <strong>{selected_designer?.name}</strong>
              </div>
              <div>
                <span>예약 일자</span>
                <strong>{form.reservation_date}</strong>
              </div>
              <div>
                <span>예약 시간</span>
                <strong>{form.reservation_time}</strong>
              </div>
              <div>
                <span>미용 방식</span>
                <strong>{form.service_type}</strong>
              </div>
              <div>
                <span>예약 채널</span>
                <strong>네이버</strong>
              </div>
            </div>

            {create_state ? (
              <div className="message_state_box">{create_state}</div>
            ) : null}

            <div className="modal_actions">
              <button
                className="secondary_button"
                type="button"
                onClick={() => set_step('form')}
                disabled={saving}
              >
                수정
              </button>
              <button
                className="primary_button"
                type="button"
                onClick={confirm_submit}
                disabled={saving}
              >
                예약 생성
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function StatusConfirmModal({
  reservation,
  current_label,
  next_label,
  on_cancel,
  on_confirm,
}) {
  return (
    <div className="modal_backdrop" role="presentation">
      <section
        className="status_confirm_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status_confirm_title"
      >
        <div className="modal_header">
          <span className="page_label">Status change</span>
          <h2 id="status_confirm_title">상태를 변경할까요?</h2>
        </div>

        <div className="modal_summary">
          <div>
            <span>강아지 이름</span>
            <strong>{reservation.dog.name}</strong>
          </div>
          <div>
            <span>견종</span>
            <strong>{reservation.dog.breed}</strong>
          </div>
          <div>
            <span>현재 단계</span>
            <strong>{current_label}</strong>
          </div>
          <div>
            <span>다음 단계</span>
            <strong>{next_label}</strong>
          </div>
        </div>

        <div className="modal_actions">
          <button className="secondary_button" type="button" onClick={on_cancel}>
            취소
          </button>
          <button className="primary_button" type="button" onClick={on_confirm}>
            맞아요, 변경하기
          </button>
        </div>
      </section>
    </div>
  )
}

function KakaoMessageModal({
  reservation,
  confirming,
  message_state,
  on_cancel,
  on_request_confirm,
  on_confirm_send,
}) {
  const sent = message_state === '전송 완료'

  return (
    <div className="modal_backdrop" role="presentation">
      <section
        className="status_confirm_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kakao_message_title"
      >
        <div className="modal_header">
          <span className="page_label">Kakao message</span>
          <h2 id="kakao_message_title">
            보호자님께 목욕 및 드라이 케어 시작 알림톡을 전송할까요?
          </h2>
        </div>

        <div className="modal_summary">
          <div>
            <span>강아지 이름</span>
            <strong>{reservation.dog.name}</strong>
          </div>
          <div>
            <span>견종</span>
            <strong>{reservation.dog.breed}</strong>
          </div>
          <div>
            <span>템플릿</span>
            <strong>목욕 및 드라이 케어 시작</strong>
          </div>
          <div>
            <span>보호자</span>
            <strong>{reservation.customer.name}</strong>
          </div>
        </div>

        {confirming ? (
          <div className="message_confirm_box">
            <strong>정말 카카오톡 메시지를 전송할까요?</strong>
            <span>
              {reservation.dog.name} 보호자님께 승인된 알림톡 템플릿이
              전송됩니다.
            </span>
          </div>
        ) : null}

        {message_state ? (
          <div className="message_state_box">{message_state}</div>
        ) : null}

        <div className="modal_actions">
          <button className="secondary_button" type="button" onClick={on_cancel}>
            {sent ? '닫기' : '나중에'}
          </button>
          {!sent && !confirming ? (
            <button
              className="primary_button"
              type="button"
              onClick={on_request_confirm}
            >
              전송하기
            </button>
          ) : null}
          {!sent && confirming ? (
            <button
              className="primary_button"
              type="button"
              onClick={on_confirm_send}
              disabled={message_state === '전송 중'}
            >
              확인하고 전송하기
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function AdminReservationGroup({
  title,
  count,
  reservations,
  selected_id,
  on_select,
}) {
  return (
    <section className="admin_reservation_group">
      <div className="admin_reservation_group_header">
        <h2>{title}</h2>
        <span>{count}건</span>
      </div>
      <div className="admin_reservation_group_list">
        {reservations.length > 0 ? (
          reservations.map((reservation) => (
            <button
              className={`dog_list_item ${
                reservation.id === selected_id ? 'dog_list_item_active' : ''
              }`}
              key={reservation.id}
              type="button"
              onClick={() => on_select(reservation.id)}
            >
              <img src={reservation.dog.photo_url} alt="" />
              <span>
                <strong>{reservation.dog.name}</strong>
                <small>
                  {reservation.check_in_time} · {reservation.service}
                </small>
              </span>
              <em>{statusCodes[reservation.current_code]}</em>
            </button>
          ))
        ) : (
          <div className="admin_empty_group">해당 아이가 없습니다.</div>
        )}
      </div>
    </section>
  )
}

function StatusPage({ reservations, update_reservation }) {
  const { reservationId } = useParams()
  const reservation = reservations.find((item) => item.id === reservationId)

  if (!reservation) {
    return (
      <main className="empty_page">
        <h1>예약을 찾을 수 없습니다.</h1>
        <Link className="text_link" to="/">
          처음으로 돌아가기
        </Link>
      </main>
    )
  }

  const toggle_daycare = () => {
    update_reservation(
      reservation.id,
      (current) => ({
        ...current,
        daycare_requested: !current.daycare_requested,
      }),
      {
        type: 'reservation',
        payload: (current) => ({
          daycare_requested: current.daycare_requested,
        }),
      },
    )
  }

  return (
    <main className="status_page">
      <section className="mobile_shell">
        <header className="status_header">
          <span className="page_label">EVER Grooming</span>
          <h1>{reservation.dog.name} 케어 현황</h1>
          <p>보호자님, 현재 진행 상태를 실시간 데모로 확인하세요.</p>
        </header>

        <section className="dog_summary">
          <img src={reservation.dog.photo_url} alt={`${reservation.dog.name}`} />
          <div>
            <strong>{reservation.dog.name}</strong>
            <span>
              {reservation.dog.breed} · {reservation.dog.weight}
            </span>
          </div>
        </section>

        <section className="highlight_status">
          <span>현재 상태</span>
          <strong>{statusCodes[reservation.current_code]}</strong>
          <small>예상 종료 {reservation.expected_finish_time}</small>
        </section>

        <section className="timeline_panel">
          <h2>진행 타임라인</h2>
          <div className="timeline_list">
            {status_entries.map((status) => {
              const done = status.code <= reservation.current_code
              const current = status.code === reservation.current_code
              const time = reservation.timeline.find(
                (item) => item.code === status.code,
              )?.time

              return (
                <div
                  className={`timeline_item ${done ? 'timeline_item_done' : ''} ${
                    current ? 'timeline_item_current' : ''
                  }`}
                  key={status.code}
                >
                  <span className="timeline_dot" />
                  <div>
                    <strong>{status.label}</strong>
                    <small>{time ?? '대기 중'}</small>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="pickup_panel">
          <div>
            <span>픽업 예정 시간</span>
            <strong>{reservation.pickup_time}</strong>
          </div>
          <button
            className={`daycare_toggle ${
              reservation.daycare_requested ? 'daycare_toggle_active' : ''
            }`}
            type="button"
            onClick={toggle_daycare}
          >
            데이케어 추가 {reservation.daycare_requested ? '선택됨' : '선택'}
          </button>
        </section>
      </section>
    </main>
  )
}

function DataSourceBadge({ data_source, sync_message }) {
  return (
    <div className="data_source_badge">
      <span>{data_source === 'sheets' ? 'Google Sheets 연결됨' : 'mockData 사용 중'}</span>
      {sync_message ? <small>{sync_message}</small> : null}
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <section className="info_section">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="info_row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default App
