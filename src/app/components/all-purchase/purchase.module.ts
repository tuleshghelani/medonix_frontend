import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { PurchaseComponent } from './purchase/purchase.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';
import { PurchaseRoutingModule } from './purchase-routing.module';
import { QcPurchaseComponent } from './qc-purchase/qc-purchase.component';

@NgModule({
  declarations: [
  
    QcPurchaseComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PurchaseRoutingModule
  ]
})
export class PurchaseModule { }