import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PurchaseComponent } from './purchase/purchase.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';

const routes: Routes = [
  { path: '', component: PurchaseComponent },
  { path: 'create', component: AddPurchaseComponent },
  { path: 'edit/:id', component: AddPurchaseComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PurchaseRoutingModule { }