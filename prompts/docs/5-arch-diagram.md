# 기술 아키텍처 다이어그램 — 정성을 보여줘

`4-project-principle.md`에 정의된 구조 원칙을 시스템 구성과 레이어 의존 관계 두 가지 관점으로 시각화한 문서다.

## 1. 시스템 아키텍처

Web Speech API는 점선 화살표로 표시했다 — 서버를 거치지 않고 브라우저 안에서만 동작하는 기능임을 나타낸다.

```mermaid
flowchart LR
    Browser[브라우저: React 앱 - 화면 렌더링/사용자 입력]
    Server[Express 서버: 라우팅·인증·비즈니스 로직 처리]
    DB[(PostgreSQL: 데이터 및 세션 저장)]
    SMTP[[SMTP: 이메일 알림 발송]]
    STT{{Web Speech API: 브라우저 내장 음성 인식}}

    Browser -->|REST API 요청/응답| Server
    Server -->|SQL 쿼리| DB
    Server -->|발송 실패해도 저장엔 영향 없음| SMTP
    Browser -.->|브라우저 내부에서만 동작, 서버 경유 없음| STT
```

## 2. 레이어 의존 흐름

백엔드와 프론트엔드 각각 레이어 이름과 단방향 화살표만 표시했다 — 각 레이어의 파일 목록은 원칙 문서를 참고한다.

```mermaid
flowchart TB
    subgraph Backend[백엔드]
        Route --> Controller --> Service --> DB[DB 접근]
    end
    subgraph Frontend[프론트엔드]
        Page --> Component --> ApiClient[API client]
    end
```
