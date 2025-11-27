import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { PurchaseComponent } from './purchase/purchase.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';
import { PurchaseRoutingModule } from './purchase-routing.module';
import { QcPurchaseComponent } from './qc-purchase/qc-purchase.component';
import { AddPurchaseReturnComponent } from './add-purchase-return/add-purchase-return.component';
import { PurchaseReturnListComponent } from './purchase-return-list/purchase-return-list.component';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@NgModule({
  declarations: [
    QcPurchaseComponent,
    AddPurchaseReturnComponent,
    PurchaseReturnListComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PurchaseRoutingModule,
    LoaderComponent,
    SearchableSelectComponent,
    PaginationComponent
  ]
})
export class PurchaseModule { }