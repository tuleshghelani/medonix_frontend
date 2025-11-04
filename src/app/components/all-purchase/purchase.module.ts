import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PurchaseComponent } from './purchase/purchase.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';
import { PurchaseRoutingModule } from './purchase-routing.module';

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    PurchaseRoutingModule
  ]
})
export class PurchaseModule { }