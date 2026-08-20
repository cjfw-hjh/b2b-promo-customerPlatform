import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 서버에서는 프론트/백엔드가 다른 포트라 프록시로 same-origin처럼 동작시킨다.
    // 프로덕션은 Express가 빌드 산출물을 직접 서빙하므로 이 설정이 필요 없다(4-project-principle.md 5번).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
