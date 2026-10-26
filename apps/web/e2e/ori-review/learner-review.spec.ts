import { expect,test } from "@playwright/test";

const ticketId="123e4567-e89b-42d3-a456-426614174000";
const proposal={schemaVersion:"ori/proposal/v0",operation:"append",
  requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]};
const issued={ticketId,proposal,appliedChanges:false};
test.describe("Ori learner proposal review",()=>{
  test.beforeEach(async({page})=>{
    await page.goto("/advanced");
    await page.getByTestId("open-ori-companion").click();
    await expect(page.getByTestId("ori-learner-review-widget")).toBeVisible();
  });
  test("requests only server-owned proposal and rejects without project writes",async({page})=>{
    let issuanceBody:unknown=null;
    let decisionBody:unknown=null;
    await page.route("**/api/tutor/ori/review/propose",async route=>{
      issuanceBody=route.request().postDataJSON();
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(issued)});
    });
    await page.route("**/api/tutor/ori/review/decision",async route=>{
      decisionBody=route.request().postDataJSON();
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({status:"rejected",appliedChanges:false})});
    });
    await page.getByRole("button",{name:"Pedir una propuesta"}).click();
    await expect(page.getByTestId("ori-proposal-review")).toBeVisible();
    await page.getByRole("button",{name:"Rechazar propuesta"}).click();
    await expect(page.getByTestId("ori-learner-review-widget").getByRole("status")).toContainText("rejected");
    expect(issuanceBody).toEqual({});
    expect(decisionBody).toEqual({ticketId,decision:"reject"});
  });
  test("does not display forged or auto-applied proposals",async({page})=>{
    await page.route("**/api/tutor/ori/review/propose",async route=>{
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({...issued,appliedChanges:true})});
    });
    await page.getByRole("button",{name:"Pedir una propuesta"}).click();
    await expect(page.getByTestId("ori-proposal-review")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("No hay una propuesta disponible");
  });
  test("surfaces stale review without claiming project mutation",async({page})=>{
    await page.route("**/api/tutor/ori/review/propose",async route=>{
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(issued)});
    });
    await page.route("**/api/tutor/ori/review/decision",async route=>{
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({status:"stale",appliedChanges:false})});
    });
    await page.getByRole("button",{name:"Pedir una propuesta"}).click();
    await page.getByRole("button",{name:"Aceptar propuesta"}).click();
    await expect(page.getByTestId("ori-proposal-review").getByRole("alert")).toContainText("ya no corresponde");
    await expect(page.getByText("No se aplicaron cambios.",{exact:true})).toHaveCount(0);
  });
});
