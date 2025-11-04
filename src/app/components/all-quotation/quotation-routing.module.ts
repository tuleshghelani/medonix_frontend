import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuotationComponent } from './quotation/quotation.component';
import { AddQuotationComponent } from './add-quotation/add-quotation.component';
import { OrderComponent } from './order/order.component';

const routes: Routes = [
  { path: '', component: QuotationComponent },
  { path: 'create', component: AddQuotationComponent },
  { path: 'edit/:id', component: AddQuotationComponent },
  { path: 'order', component: OrderComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class QuotationRoutingModule { }