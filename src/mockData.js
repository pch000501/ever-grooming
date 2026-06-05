export const statusCodes = {
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

export const customers = [
  {
    id: 'customer_001',
    name: '김서윤',
    phone: '010-4821-1834',
    preferred_contact: '카카오톡',
  },
  {
    id: 'customer_002',
    name: '이지후',
    phone: '010-7392-6110',
    preferred_contact: '전화',
  },
  {
    id: 'customer_003',
    name: '박하린',
    phone: '010-2468-9051',
    preferred_contact: '문자',
  },
  {
    id: 'customer_004',
    name: '최유나',
    phone: '010-5581-3042',
    preferred_contact: '카카오톡',
  },
]

export const designers = [
  {
    id: 'des_001',
    name: 'Jina',
    position: '수석 디자이너',
    specialty: '푸들 가위컷, 얼굴 라인',
    profile_image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'des_002',
    name: 'Mina',
    position: '펫 스타일리스트',
    specialty: '위생 미용, 말티즈 스타일',
    profile_image:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'des_003',
    name: 'Soo',
    position: '디자이너',
    specialty: '클리핑, 피부 민감견 케어',
    profile_image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
  },
]

export const dogs = [
  {
    id: 'dog_001',
    customer_id: 'customer_001',
    name: '모찌',
    breed: '비숑 프리제',
    age: '3살',
    weight: '5.2kg',
    temperament: '낯가림이 있지만 간식에 잘 반응',
    allergies: '닭고기 알러지',
    photo_url:
      'https://images.pexels.com/photos/15845917/pexels-photo-15845917.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'dog_002',
    customer_id: 'customer_002',
    name: '라떼',
    breed: '말티푸',
    age: '2살',
    weight: '4.1kg',
    temperament: '사람을 좋아하고 발 만지는 것을 싫어함',
    allergies: '없음',
    photo_url:
      'https://images.pexels.com/photos/6784803/pexels-photo-6784803.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'dog_003',
    customer_id: 'customer_003',
    name: '밤비',
    breed: '포메라니안',
    age: '5살',
    weight: '3.6kg',
    temperament: '조용하지만 드라이어 소리에 예민',
    allergies: '피부 민감',
    photo_url:
      'https://images.pexels.com/photos/14973510/pexels-photo-14973510.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'dog_004',
    customer_id: 'customer_004',
    name: '코코',
    breed: '토이 푸들',
    age: '4살',
    weight: '3.9kg',
    temperament: '활발하고 낯선 소리에 빠르게 반응',
    allergies: '없음',
    photo_url:
      'https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=600&q=80',
  },
]

export const reservations = [
  {
    id: 'res_240501_001',
    customer_id: 'customer_001',
    dog_id: 'dog_001',
    date: '2026-05-26',
    check_in_time: '10:00',
    service: '프리미엄 풀컷 + 스파',
    add_ons: ['치석 케어', '보습 팩'],
    groomer: 'Jina',
    pickup_time: '13:20',
    internal_note: '얼굴 라인은 둥글게, 귀는 짧게 정리 요청.',
    daycare_requested: false,
  },
  {
    id: 'res_240501_002',
    customer_id: 'customer_002',
    dog_id: 'dog_002',
    date: '2026-05-26',
    check_in_time: '11:30',
    service: '위생 미용 + 목욕',
    add_ons: ['발톱 정리'],
    groomer: 'Mina',
    pickup_time: '14:50',
    internal_note: '발 만질 때 천천히 진행. 보호자에게 완료 전 연락.',
    daycare_requested: true,
  },
  {
    id: 'res_240501_003',
    customer_id: 'customer_003',
    dog_id: 'dog_003',
    date: '2026-05-26',
    check_in_time: '12:00',
    service: '가위컷 + 저자극 목욕',
    add_ons: ['피부 진정 케어'],
    groomer: 'Soo',
    pickup_time: '15:30',
    internal_note: '드라이어 약풍 사용. 등 털 볼륨 유지.',
    daycare_requested: false,
  },
  {
    id: 'res_240501_004',
    customer_id: 'customer_004',
    dog_id: 'dog_004',
    date: '2026-05-26',
    check_in_time: '16:00',
    service: '푸들 베이직 컷 + 목욕',
    add_ons: ['귀 세정'],
    groomer: 'Jina',
    pickup_time: '19:20',
    internal_note: '첫 방문. 전체 길이는 짧지 않게 상담 후 진행.',
    daycare_requested: false,
  },
]

export const groomingStatus = [
  {
    reservation_id: 'res_240501_001',
    current_code: 3,
    updated_at: '12:10',
    timeline: [
      { code: 0, time: '10:04' },
      { code: 1, time: '10:18' },
      { code: 2, time: '11:05' },
      { code: 3, time: '12:10' },
    ],
  },
  {
    reservation_id: 'res_240501_002',
    current_code: 1,
    updated_at: '11:48',
    timeline: [
      { code: 0, time: '11:34' },
      { code: 1, time: '11:48' },
    ],
  },
  {
    reservation_id: 'res_240501_003',
    current_code: 5,
    updated_at: '14:52',
    timeline: [
      { code: 0, time: '12:03' },
      { code: 1, time: '12:18' },
      { code: 2, time: '13:05' },
      { code: 3, time: '13:42' },
      { code: 4, time: '14:35' },
      { code: 5, time: '14:52' },
    ],
  },
  {
    reservation_id: 'res_240501_004',
    current_code: -1,
    updated_at: '16:00',
    timeline: [{ code: -1, time: '16:00' }],
  },
]
