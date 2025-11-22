import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { PurchaseComponent } from './purchase/purchase.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';
import { PurchaseRoutingModule } from './purchase-routing.module';
import { QcPurchaseComponent } from './qc-purchase/qc-purchase.component';
import { AddPurchaseReturnComponent } from './add-purchase-return/add-purchase-return.component';

@NgModule({
  declarations: [
    QcPurchaseComponent,
    AddPurchaseReturnComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PurchaseRoutingModule
  ]
})
export class PurchaseModule { }