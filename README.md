# freee ChatGPT Apps SDK

freee Public API를 사용하여 ChatGPT에서 청구서 발급 등의 기능을 제공하는 MCP 서버입니다.

## 아키텍처

```
┌─────────────┐     ┌─────────────────────────────────────┐     ┌─────────────┐
│   ChatGPT   │────▶│     OAuth Proxy + MCP Server        │────▶│  freee API  │
│   Client    │◀────│  (이 서버)                           │◀────│             │
└─────────────┘     └─────────────────────────────────────┘     └─────────────┘
```

ChatGPT Apps SDK는 OAuth 2.1, PKCE, Dynamic Client Registration(DCR)을 요구하지만, freee API는 이를 지원하지 않습니다. 이 서버는 두 시스템 사이에서 프록시 역할을 합니다.

## 제공 기능

### OAuth 엔드포인트
- `/.well-known/oauth-authorization-server` - OAuth 메타데이터
- `/.well-known/oauth-protected-resource` - Protected Resource 메타데이터
- `POST /oauth/register` - Dynamic Client Registration
- `GET /oauth/authorize` - 인가 엔드포인트 (PKCE 지원)
- `GET /oauth/callback` - freee OAuth 콜백
- `POST /oauth/token` - 토큰 엔드포인트

### MCP 도구
- `freee_get_me` - 현재 사용자 정보 조회
- `freee_get_company` - 사업소 정보 조회
- `freee_list_partners` - 거래처 목록 조회
- `freee_get_partner` - 거래처 상세 조회
- `freee_create_partner` - 거래처 생성
- `freee_list_account_items` - 계정과목 목록 조회
- `freee_list_tax_codes` - 세금 코드 목록 조회
- `freee_list_invoices` - 청구서 목록 조회
- `freee_get_invoice` - 청구서 상세 조회
- `freee_create_invoice` - 청구서 생성
- `freee_update_invoice` - 청구서 업데이트
- `freee_delete_invoice` - 청구서 삭제

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
# Server Configuration
PORT=2091
BASE_URL=https://your-ngrok-subdomain.ngrok.app

# freee OAuth Configuration
FREEE_CLIENT_ID=your_freee_client_id
FREEE_CLIENT_SECRET=your_freee_client_secret

# JWT Secret
JWT_SECRET=your_random_jwt_secret_key

# Database
DATABASE_PATH=./data/app.db
```

### 3. freee 앱 등록

1. [freee 개발자 콘솔](https://app.secure.freee.co.jp/developers/applications)에 접속
2. 새 앱 등록:
   - 앱 타입: Public
   - 콜백 URL: `https://your-ngrok-subdomain.ngrok.app/oauth/callback`
3. Client ID와 Client Secret을 `.env`에 입력

### 4. 서버 실행

개발 모드:
```bash
npm run dev
```

프로덕션 빌드:
```bash
npm run build
npm start
```

### 5. ngrok으로 외부 노출

```bash
ngrok http 2091
```

ngrok에서 제공하는 URL (예: `https://abc123.ngrok.app`)을:
- `.env`의 `BASE_URL`에 설정
- freee 앱의 콜백 URL에 설정

## ChatGPT Apps SDK 연동

### 개발자 모드 테스트

ChatGPT Apps SDK 개발자 모드에서 앱을 테스트하려면:

1. ChatGPT에서 개발자 모드 활성화
2. MCP 서버 URL 입력: `https://your-ngrok-subdomain.ngrok.app/mcp`
3. 인증 플로우 진행

### 인증 플로우

1. ChatGPT가 `/.well-known/oauth-protected-resource`를 조회
2. ChatGPT가 `/oauth/register`로 클라이언트 등록 (DCR)
3. 사용자가 `/oauth/authorize`로 리다이렉트
4. freee 로그인 후 사업소 선택
5. 인가 코드를 받아 토큰 교환
6. MCP 도구 사용 가능

## 프로젝트 구조

```
src/
├── index.ts              # 메인 서버
├── config/
│   └── env.ts            # 환경 설정
├── oauth/
│   ├── metadata.ts       # Well-known 엔드포인트
│   ├── dcr.ts            # Dynamic Client Registration
│   ├── authorize.ts      # 인가 엔드포인트
│   ├── token.ts          # 토큰 엔드포인트
│   └── pkce.ts           # PKCE 유틸리티
├── mcp/
│   ├── server.ts         # MCP 서버
│   └── tools/
│       ├── invoices.ts   # 청구서 도구
│       └── accounting.ts # 회계 도구
├── freee/
│   ├── client.ts         # freee API 클라이언트
│   ├── auth.ts           # freee OAuth
│   └── types.ts          # freee API 타입
└── db/
    ├── index.ts          # DB 초기화
    └── models/           # DB 모델
```

## 개발

### TypeScript 빌드

```bash
npm run build
```

### 개발 모드 (핫 리로드)

```bash
npm run dev
```

## 주의사항

- **보안**: JWT_SECRET은 반드시 안전한 랜덤 문자열로 설정하세요
- **토큰 관리**: freee 토큰은 6시간 후 만료되며, 리프레시 토큰은 90일간 유효합니다
- **API 제한**: freee API에는 Rate Limit이 있으니 주의하세요
- **프로덕션**: 프로덕션 환경에서는 PostgreSQL 등 별도 DB 사용을 권장합니다

## 라이선스

ISC
