import{expect,test}from'@playwright/test'

const required=['E2E_USER_A_EMAIL','E2E_USER_A_PASSWORD','E2E_USER_B_EMAIL','E2E_USER_B_PASSWORD','E2E_WORKSPACE_A_ID','E2E_WORKSPACE_B_ID'] as const
const configured=required.every(k=>Boolean(process.env[k]))

test.describe('production tenant isolation',()=>{
 test.skip(!configured,'Requires two dedicated production-test users and workspaces; never fabricate isolation results.')
 test('cross-workspace access is denied through the application',async({page})=>{
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(process.env.E2E_USER_A_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.E2E_USER_A_PASSWORD!)
  await page.getByRole('button',{name:/sign in|log in/i}).click()
  await page.waitForURL(/dashboard|projects/)
  await page.goto(`/projects?workspace=${process.env.E2E_WORKSPACE_B_ID}`)
  await expect(page.getByText(/access denied|not found|unauthorized/i)).toBeVisible({timeout:10000})
 })
})
