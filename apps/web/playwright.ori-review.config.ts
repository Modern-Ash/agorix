import { defineConfig } from "@playwright/test";

const port=Number(process.env.AGORIX_ORI_E2E_PORT??4187);
const host="127.0.0.1";
export default defineConfig({
  testDir:"./e2e/ori-review",
  timeout:30000,
  webServer:{
    command:`VITE_ORI_LEARNER_REVIEW=1 AGORIX_DEV_BACKEND=1 corepack pnpm dev --host ${host} --port ${port}`,
    url:`http://${host}:${port}`,
    reuseExistingServer:false,
    timeout:120000
  },
  use:{baseURL:`http://${host}:${port}`,locale:"es-AR"},
});
