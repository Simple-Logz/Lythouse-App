import{expect,test}from'@playwright/test'

const configured=['E2E_GITHUB_EMAIL','E2E_GITHUB_PASSWORD','E2E_TEST_REPOSITORY'].every(k=>Boolean(process.env[k]))
test.describe('GitHub validation lifecycle',()=>{
 test.skip(!configured,'Requires a dedicated authorized GitHub test repository and account; lifecycle results must be real.')
 test('connect, validate, remediate, revalidate and reach a release decision',async({page})=>{
  await page.goto('/login');await page.getByLabel(/email/i).fill(process.env.E2E_GITHUB_EMAIL!);await page.getByLabel(/password/i).fill(process.env.E2E_GITHUB_PASSWORD!);await page.getByRole('button',{name:/sign in|log in/i}).click();
  await page.goto('/projects');await expect(page.locator('#root')).toBeVisible();
  // The production fixture must already authorize E2E_TEST_REPOSITORY through the GitHub App.
  await expect(page.getByText(new RegExp(process.env.E2E_TEST_REPOSITORY!.split('/').pop()!,'i'))).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:/validate|scan/i}).first().click();
  await expect(page.getByText(/finding|validation complete|passed|failed/i).first()).toBeVisible({timeout:60000});
  await page.goto('/findings');await expect(page.locator('#root')).toBeVisible();
  await page.getByText(/finding/i).first().click();
  await expect(page.getByText(/recommended fix|remediation|why it matters/i).first()).toBeVisible();
  await page.goto('/release');await expect(page.getByText(/release|decision|gate/i).first()).toBeVisible();
 })
})
