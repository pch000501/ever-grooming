# EVER Grooming Google Sheets Setup

Google Sheets URL:

```text
https://docs.google.com/spreadsheets/d/1HlckP33CABh5ulGTnykeOyYqPfyxUMSmP7RQgg08ZlU/edit
```

Netlify 배포에서는 브라우저가 Google Sheets에 직접 접근하지 않고,
`netlify/functions/reservations.js`가 서버 API 역할을 합니다.

## Netlify 환경 변수

Netlify Site settings > Environment variables에 아래 값을 추가합니다.

```text
GOOGLE_SHEET_ID=1HlckP33CABh5ulGTnykeOyYqPfyxUMSmP7RQgg08ZlU
GOOGLE_SERVICE_ACCOUNT_EMAIL=서비스계정 client_email
GOOGLE_PRIVATE_KEY=서비스계정 private_key
```

`GOOGLE_PRIVATE_KEY`는 `-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`
까지 전체 값을 넣습니다. Netlify UI에서 줄바꿈이 깨지면 `\n` 형태도 지원합니다.

## Google Cloud 설정

1. Google Cloud에서 프로젝트를 만들고 Google Sheets API를 활성화합니다.
2. Service Account를 생성합니다.
3. Service Account 키를 JSON으로 발급합니다.
4. `EVER_testDB` 스프레드시트를 Service Account 이메일에 공유합니다.

## 현재 앱이 읽는 시트 구조

현재 스프레드시트의 7개 탭을 그대로 사용합니다.

### `CUSTOMERS`

```csv
customer_id,customer_name,phone,kakao_opt_in,visit_count,customer_note,created_at
cus_001,김민지,1012345678,TRUE,3,픽업 시간 민감,2026-05-26 10:00
```

### `DOGS`

```csv
dog_id,customer_id,dog_name,breed,gender,birth_year,weight,neutered,allergy,personality,skin_condition,dog_note,created_at
dog_001,cus_001,초코,푸들,남아,2022,4.2,TRUE,닭고기,낯가림 있음,건조함,발 만지는 거 싫어함,2026-05-26 10:00
```

### `RESERVATIONS`

```csv
reservation_id,customer_id,dog_id,reservation_date,reservation_time,designer_id,service_type,additional_service,reservation_channel,reservation_status,consultation_note,created_at
res_001,cus_001,dog_001,2026-05-26,14:00,des_001,디자인 미용,스파 케어,네이버,in_progress,얼굴 라운드 스타일 요청,2026-05-26 11:00
```

### `GROOMING_STATUS`

```csv
reservation_id,current_status_code,current_status_label,bath_started_at,extra_care_started_at,grooming_started_at,completed_at,pickup_waiting_at,daycare_started_at,picked_up_at,estimated_end_time,pickup_time,daycare_enabled,daycare_hours,internal_memo,updated_at
res_001,1,목욕 중,2026-05-26 14:10,,,,,,2026-05-26 16:00,2026-05-26 16:00,FALSE,0,피부 건조 상태 확인,2026-05-26 14:10
```

### `STATUS_LOG`

상태 변경이 확정되면 앱이 아래 컬럼 순서로 새 로그 행을 추가합니다.

```csv
log_id,reservation_id,previous_status,next_status,changed_at,changed_by
log_001,res_001,waiting,bath,2026-05-26 14:10,지수 디자이너
```

### `STATUS_CODES`

현재 시트에 있는 `0`부터 `7`까지의 상태는 그대로 사용합니다.
예약 일정용 상태를 명시하려면 아래 행을 추가하는 것을 추천합니다.

```csv
-1,visit_waiting,방문 대기 중,방문 확인,TRUE,-1
```

앱과 API에는 이미 `-1 = 방문 대기 중` fallback이 들어가 있어서, 이 행이 없어도 화면 표시는 됩니다.

### `DESIGNERS`

```csv
designer_id,designer_name,position,specialty,active
des_001,지수 디자이너,실장,"푸들, 비숑",TRUE
```

## 상태 처리 규칙

- `RESERVATIONS.reservation_status`가 `reserved`이면 앱에서는 `방문 대기 중`으로 표시합니다.
- `in_progress` 예약은 `GROOMING_STATUS.current_status_code`를 기준으로 표시합니다.
- 관리자 화면에서 상태를 변경하면 `GROOMING_STATUS`의 `current_status_code`, `current_status_label`, `updated_at`이 저장됩니다.
- 상태별 시작 시간 컬럼도 함께 저장됩니다.

## 로컬 테스트

Netlify Functions까지 포함해서 테스트하려면 Netlify CLI가 필요합니다.

```bash
npx netlify login
npx netlify env:set GOOGLE_SHEET_ID "1HlckP33CABh5ulGTnykeOyYqPfyxUMSmP7RQgg08ZlU"
npx netlify env:set GOOGLE_SERVICE_ACCOUNT_EMAIL "..."
npx netlify env:set GOOGLE_PRIVATE_KEY "..."
npm run dev:netlify
```

일반 `npm run dev`는 Functions 없이 Vite만 실행되므로 앱이 자동으로 mockData를 사용합니다.

## 배포 주의

Google Sheets 연동은 Netlify Functions가 필요합니다. `dist` 폴더만 드래그 앤 드롭으로 업로드하면
정적 화면은 올라가지만 `/api/reservations` 함수는 배포되지 않을 수 있습니다.

가장 안정적인 방법은 GitHub 저장소를 Netlify에 연결하거나 Netlify CLI로 프로젝트 전체를 배포하는 방식입니다.

## Solapi 카카오톡 발송 환경 변수

상태 변경 후 보호자에게 카카오톡 알림톡을 전송하려면 Netlify 환경 변수에 아래 값을 추가합니다.

```text
SOLAPI_API_KEY=솔라피 API Key
SOLAPI_API_SECRET=솔라피 API Secret
SOLAPI_FROM=솔라피에 등록된 발신번호
SOLAPI_PFID=카카오 채널 연동 ID
SOLAPI_TEMPLATE_ID=알림톡 템플릿 ID
SOLAPI_DISABLE_SMS=true
```

`SOLAPI_DISABLE_SMS`는 선택값입니다. `true`로 설정하면 알림톡 실패 시 문자 대체발송을 막습니다.

현재 코드가 알림톡 템플릿에 전달하는 변수는 아래와 같습니다.

```text
#{보호자명}
#{강아지명}
#{견종}
#{상태}
#{픽업시간}
```

Solapi 알림톡은 등록 및 승인된 템플릿으로만 발송됩니다. 템플릿의 변수명이 위 값과 다르면
`netlify/functions/reservations.js`의 `build_kakao_variables`를 템플릿에 맞게 수정해야 합니다.
