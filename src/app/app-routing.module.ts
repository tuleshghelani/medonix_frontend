import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { LoginComponent } from './components/auth/login/login.component';
import { CategoryComponent } from './components/category/category.component';
import { ProductComponent } from './components/product/product.component';
import { AuthGuard } from './guards/auth.guard';

import { SaleComponent } from './components/sale/sale.component';
import { ProfitComponent } from './components/profit/profit.component';
import { CustomerComponent } from './components/customer/customer.component';
import { AddCombinedPurchaseSaleComponent } from './components/add-combined-purchase-sale/add-combined-purchase-sale.component';
import { EmployeeListComponent } from './components/employee/employee-list/employee-list.component';
import { EmployeeFormComponent } from './components/employee/employee-form/employee-form.component';
import { EmployeeOrderListComponent } from './components/employee-order/employee-order-list/employee-order-list.component';
import { EmployeeOrderFormComponent } from './components/employee-order/employee-order-form/employee-order-form.component';
import { DailyProfitComponent } from './components/all-profits/daily-profit/daily-profit.component';
import { CreateAttendanceComponent } from './components/attendance/create-attendance/create-attendance.component';
import { AttendanceListComponent } from './components/attendance/attendance-list/attendance-list.component';
import { AttendanceDetailComponent } from './components/attendance/attendance-detail/attendance-detail.component';
import { AddSaleComponent } from './components/add-sale/add-sale.component';
import { AddSaleReturnComponent } from './components/add-sale-return/add-sale-return.component';
import { SaleReturnListComponent } from './components/sale-return-list/sale-return-list.component';
import { DataCenterComponent } from './components/data-center/data-center.component';
import { RoleGuard } from './guards/role.guard';
import { UserListComponent } from './components/users/user-list/user-list.component';
import { AddUserComponent } from './components/users/add-user/add-user.component';
import { AddDealerComponent } from './components/dealers/add-dealer/add-dealer.component';
import { TransportMasterListComponent } from './components/Transports/transport-master-list/transport-master-list.component';
import { AddTransportComponent } from './components/Transports/add-transport/add-transport.component';
import { LedgerComponent } from './components/ledger/ledger.component';
import { PaymentHistoryListComponent } from './components/payment-history/payment-history-list/payment-history-list.component';
import { AddPaymentHistoryComponent } from './components/payment-history/add-payment-history/add-payment-history.component';
import { CustomerPriceListComponent } from './components/all-customer-price/customer-price-list/customer-price-list.component';
import { DealerAddQuotationComponent } from './components/all-quotation/dealer-add-quotation/dealer-add-quotation.component';
import { AddCustomerPriceComponent } from './components/all-customer-price/add-customer-price/add-customer-price.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'category', 
    component: CategoryComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  { 
    path: 'product', 
    component: ProductComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  { 
    path: 'purchase', 
    loadChildren: () => import('./components/all-purchase/purchase.module').then(m => m.PurchaseModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  { 
    path: 'purchase-challan', 
    loadChildren: () => import('./components/all-purchase/purchase-challan.module').then(m => m.PurchaseChallanModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  { 
    path: 'purchase-order', 
    loadChildren: () => import('./components/all-purchase/purchase-order.module').then(m => m.PurchaseOrderModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  {
    path: 'sale',
    component: SaleComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  {
    path: 'sale/create',
    component: AddSaleComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'sale/return/create',
    component: AddSaleReturnComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'sale/return/:id',
    component: AddSaleReturnComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'sale/return',
    component: SaleReturnListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN','DEALER'] }
  },
  {
    path: 'profit',
    component: ProfitComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'customer',
    component: CustomerComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'combined-purchase-sale',
    component: AddCombinedPurchaseSaleComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'transport-master',
    component: TransportMasterListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'SALES_AND_MARKETING', 'DISPATCH'] }
  },
  {
    path: 'transport-master/create',
    component: AddTransportComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'SALES_AND_MARKETING', 'DISPATCH'] }
  },
  {
    path: 'transport-master/edit',
    component: AddTransportComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'SALES_AND_MARKETING', 'DISPATCH'] }
  },
  {
    path: 'employee',
    component: EmployeeListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'employee/create',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },  
  {
    path: 'employee/edit/:id',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'employee-order',
    component: EmployeeOrderListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'employee-order/create',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },  
  {
    path: 'employee-order/edit/:id',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'attendance',
    component: AttendanceListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'attendance/create',
    component: CreateAttendanceComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'attendance/details',
    component: AttendanceDetailComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'daily-profit',
    component: DailyProfitComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'ledger',
    component: LedgerComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  {
    path: 'quotation', 
    loadChildren: () => import('./components/all-quotation/quotation.module').then(m => m.QuotationModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },  
  // Payment Routes
  {
    path: 'payment-history',
    component: PaymentHistoryListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'SALES_AND_MARKETING'] }
  },
  {
    path: 'payment-history/add',
    component: AddPaymentHistoryComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'SALES_AND_MARKETING'] }
  },
  {
    path: 'payment-history/edit/:encryptedId',
    component: AddPaymentHistoryComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'SALES_AND_MARKETING'] }
  },
  {
    path: 'data-center',
    component: DataCenterComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'users/edit/:id',
    component: AddUserComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: 'dealers/register',
    component: AddDealerComponent,
    // canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN','STAFF_ADMIN','DEALER'] }
  },
  {
    path: 'customer-price',
    component: CustomerPriceListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  {
    path: 'customer-price/add',
    component: AddCustomerPriceComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'STAFF_ADMIN', 'DEALER'] }
  },
  {
    path: 'chart',
    loadChildren: () => import('./components/chart/chart.module').then(m => m.ChartModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'STAFF_ADMIN'] }
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full'
  },
];

@NgModule({
  // imports: [RouterModule.forRoot(routes, { useHash: true })],  
  imports: [RouterModule.forRoot(routes, { useHash: true, preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }