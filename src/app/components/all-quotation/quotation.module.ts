import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { QuotationComponent } from './quotation/quotation.component';
import { AddQuotationComponent } from './add-quotation/add-quotation.component';
import { OrderComponent } from './order/order.component';
import { QuotationRoutingModule } from './quotation-routing.module';

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    QuotationRoutingModule,
    QuotationComponent,
    AddQuotationComponent,
    OrderComponent
  ]
})
export class QuotationModule { }