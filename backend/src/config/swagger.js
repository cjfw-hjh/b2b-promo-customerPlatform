// swagger-jsdoc 등 파서 없이 OpenAPI 3.0 스펙을 순수 객체 리터럴로 직접 작성한다.
// (프로젝트 원칙 4번의 "OpenAPI 코드젠 금지"는 프론트-백엔드 타입 자동 동기화 도구를 뜻하며,
//  여기서는 사람이 API 문서를 열람하기 위한 swagger-ui-express 용도로 의도적으로 예외 적용한다.)

const cookieAuth = { cookieAuth: [] };

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: '정성을 보여줘 API',
    version: '1.0.0',
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employeeNo: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['salesperson', 'manager'] },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      SalesLog: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          customerId: { type: 'integer' },
          activityType: { type: 'string', enum: ['외근', '내근', '기타'] },
          activityContent: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['작성 완료', '코멘트 진행중'] },
        },
      },
      ManagedSalesLog: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          customerId: { type: 'integer' },
          activityType: { type: 'string', enum: ['외근', '내근', '기타'] },
          activityContent: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['작성 완료', '코멘트 진행중'] },
          authorEmployeeNo: { type: 'string' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['팀장 코멘트', '답변'] },
        },
      },
      CustomerKnowhow: {
        type: 'object',
        properties: {
          authorEmployeeNo: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          activityContent: { type: 'string' },
        },
      },
      ManagedComment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          salesLogId: { type: 'integer' },
          customerName: { type: 'string' },
          authorEmployeeNo: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: '헬스체크',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } },
          },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        summary: '회원가입',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employeeNo', 'email', 'password', 'role'],
                properties: {
                  employeeNo: { type: 'string', description: '6자' },
                  email: { type: 'string' },
                  password: { type: 'string', description: '7자 이상' },
                  role: { type: 'string', enum: ['salesperson', 'manager'] },
                  managerEmail: { type: 'string', description: 'role이 salesperson이면 필수' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: '가입 성공',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          400: errorResponse('검증 실패 또는 중복'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: '로그인',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: '로그인 성공, 세션 쿠키 설정',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'integer' }, role: { type: 'string', enum: ['salesperson', 'manager'] } },
                },
              },
            },
          },
          401: errorResponse('인증 실패'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: '로그아웃',
        responses: { 204: { description: '세션 제거 완료' } },
      },
    },
    '/api/customers': {
      get: {
        summary: '거래처 목록 조회',
        security: [cookieAuth],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } } },
            },
          },
          401: errorResponse('인증 필요'),
        },
      },
    },
    '/api/customers/{id}/knowhow': {
      get: {
        summary: '거래처 노하우(같은 팀장 산하 그룹의 영업활동 이력) 조회',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CustomerKnowhow' } } },
            },
          },
          401: errorResponse('인증 필요'),
          404: errorResponse('존재하지 않는 거래처'),
        },
      },
    },
    '/api/sales-logs': {
      post: {
        summary: '영업일지 작성',
        security: [cookieAuth],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['customerId', 'activityType', 'activityContent'],
                properties: {
                  customerId: { type: 'integer' },
                  activityType: { type: 'string', enum: ['외근', '내근', '기타'] },
                  activityContent: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: '작성 완료',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SalesLog' } } },
          },
          400: errorResponse('검증 실패'),
          401: errorResponse('인증 필요'),
          403: errorResponse('영업사원 권한 필요'),
        },
      },
      get: {
        summary: '영업일지 검색/목록 조회',
        security: [cookieAuth],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD' },
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
          { name: 'activityType', in: 'query', schema: { type: 'string', enum: ['외근', '내근', '기타'] } },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SalesLog' } } },
            },
          },
          401: errorResponse('인증 필요'),
        },
      },
    },
    '/api/sales-logs/{id}': {
      get: {
        summary: '영업일지 단건 조회',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SalesLog' } } },
          },
          401: errorResponse('인증 필요'),
          403: errorResponse('권한 없음'),
          404: errorResponse('존재하지 않음'),
        },
      },
      patch: {
        summary: '영업일지 수정',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customerId: { type: 'integer' },
                  activityType: { type: 'string', enum: ['외근', '내근', '기타'] },
                  activityContent: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: '수정 완료',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SalesLog' } } },
          },
          400: errorResponse('검증 실패'),
          401: errorResponse('인증 필요'),
          403: errorResponse('권한 없음'),
          404: errorResponse('존재하지 않음'),
        },
      },
      delete: {
        summary: '영업일지 삭제',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: '삭제 완료' },
          401: errorResponse('인증 필요'),
          403: errorResponse('작성자가 아니거나 코멘트가 존재함'),
          404: errorResponse('존재하지 않음'),
        },
      },
    },
    '/api/sales-logs/{id}/comments': {
      get: {
        summary: '영업일지 코멘트 목록 조회',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Comment' } } },
            },
          },
          401: errorResponse('인증 필요'),
          403: errorResponse('작성자 본인 또는 담당 팀장만 조회 가능'),
          404: errorResponse('존재하지 않음'),
        },
      },
      post: {
        summary: '영업일지 코멘트 작성',
        security: [cookieAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
            },
          },
        },
        responses: {
          201: {
            description: '작성 완료',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Comment' } } },
          },
          400: errorResponse('검증 실패'),
          401: errorResponse('인증 필요'),
          403: errorResponse('권한 없음 또는 팀장 코멘트 없이 답변 시도'),
          404: errorResponse('존재하지 않음'),
        },
      },
    },
    '/api/managed/sales-logs': {
      get: {
        summary: '팀장 - 담당 영업사원 영업일지 전체 조회',
        security: [cookieAuth],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ManagedSalesLog' } },
              },
            },
          },
          401: errorResponse('인증 필요'),
          403: errorResponse('팀장 권한 필요'),
        },
      },
    },
    '/api/managed/comments': {
      get: {
        summary: '팀장 - 본인이 남긴 코멘트 전체 조회',
        security: [cookieAuth],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ManagedComment' } } },
            },
          },
          401: errorResponse('인증 필요'),
          403: errorResponse('팀장 권한 필요'),
        },
      },
    },
  },
};
