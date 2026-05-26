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

function get_current_time() {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date())
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
  return {
    reservation_id: status?.reservation_id ?? reservation.id,
    current_code: Number(status?.current_code ?? 0),
    updated_at: status?.updated_at ?? reservation.check_in_time,
    timeline: status?.timeline ?? [{ code: 0, time: reservation.check_in_time }],
  }
}

function build_reservations(data) {
  const source = data ?? {
    customers: mock_customers,
    dogs: mock_dogs,
    reservations: mock_reservations,
    groomingStatus: mock_grooming_status,
  }

  return source.reservations.map((raw_reservation) => {
    const reservation = normalize_reservation(raw_reservation)
    const customer = source.customers.find(
      (item) => item.id === reservation.customer_id,
    )
    const dog = source.dogs.find((item) => item.id === reservation.dog_id)
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
    throw new Error(`API update failed: ${response.status}`)
  }

  return response.json()
}

function App() {
  const [reservation_list, set_reservation_list] = useState(build_reservations)
  const [data_source, set_data_source] = useState('mock')
  const [sync_message, set_sync_message] = useState('')

  useEffect(() => {
    let canceled = false

    load_reservations_from_api()
      .then((data) => {
        if (canceled) return
        set_reservation_list(build_reservations(data))
        set_data_source('sheets')
      })
      .catch(() => {
        if (canceled) return
        set_reservation_list(build_reservations())
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
  const selected_reservation = useMemo(
    () =>
      reservations.find((reservation) => reservation.id === selected_id) ??
      reservations.find((reservation) => reservation.id === default_selected_id),
    [default_selected_id, reservations, selected_id],
  )

  const update_status_to = (target_code) => {
    update_reservation(
      selected_reservation.id,
      (reservation) => {
      const updated_time = get_current_time()
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
          current_code: reservation.current_code,
          updated_at: reservation.updated_at,
          timeline: reservation.timeline,
        }),
      },
    )
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

  if (!selected_reservation) {
    return <main className="empty_page">오늘 예약이 없습니다.</main>
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
        <Link className="text_link" to={`/status/${selected_reservation.id}`}>
          고객 화면 보기
        </Link>
      </header>

      <section className="admin_layout">
        <aside className="dog_list_panel">
          <AdminReservationGroup
            title="현재 진행 중"
            count={grooming_reservations.length}
            reservations={grooming_reservations}
            selected_id={selected_reservation.id}
            on_select={set_selected_id}
          />
          <AdminReservationGroup
            title="예약 일정"
            count={scheduled_reservations.length}
            reservations={scheduled_reservations}
            selected_id={selected_reservation.id}
            on_select={set_selected_id}
          />
        </aside>

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
                          onClick={() => update_status_to(next_status.code)}
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
      </section>
    </main>
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
