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
import { TransportComponent } from './components/Transports/transport/transport.component';
import { TransportListComponent } from './components/Transports/transport-list/transport-list.component';
import { EmployeeListComponent } from './components/employee/employee-list/employee-list.component';
import { EmployeeFormComponent } from './components/employee/employee-form/employee-form.component';
import { EmployeeOrderListComponent } from './components/employee-order/employee-order-list/employee-order-list.component';
import { EmployeeOrderFormComponent } from './components/employee-order/employee-order-form/employee-order-form.component';
import { DailyProfitComponent } from './components/all-profits/daily-profit/daily-profit.component';
import { CreateAttendanceComponent } from './components/attendance/create-attendance/create-attendance.component';
import { AttendanceListComponent } from './components/attendance/attendance-list/attendance-list.component';
import { AttendanceDetailComponent } from './components/attendance/attendance-detail/attendance-detail.component';
import { AddSaleComponent } from './components/add-sale/add-sale.component';
import { DataCenterComponent } from './components/data-center/data-center.component';
import { RoleGuard } from './guards/role.guard';
import { UserListComponent } from './components/users/user-list/user-list.component';
import { AddUserComponent } from './components/users/add-user/add-user.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'category', 
    component: CategoryComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },
  { 
    path: 'product', 
    component: ProductComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },
  { 
    path: 'purchase', 
    loadChildren: () => import('./components/all-purchase/purchase.module').then(m => m.PurchaseModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN'] }
  },
  {
    path: 'sale',
    component: SaleComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'sale/create',
    component: AddSaleComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
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
    path: 'transport/create',
    component: TransportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'transport',
    component: TransportListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'transport/edit/:id',
    component: TransportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee',
    component: EmployeeListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'employee/create',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },  
  {
    path: 'employee/edit/:id',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'employee-order',
    component: EmployeeOrderListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'employee-order/create',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },  
  {
    path: 'employee-order/edit/:id',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'attendance',
    component: AttendanceListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },
  {
    path: 'attendance/create',
    component: CreateAttendanceComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },
  {
    path: 'attendance/details',
    component: AttendanceDetailComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },
  {
    path: 'daily-profit',
    component: DailyProfitComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'quotation', 
    loadChildren: () => import('./components/all-quotation/quotation.module').then(m => m.QuotationModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN', 'PRODUCT_MANAGER'] }
  },  
  {
    path: 'data-center',
    component: DataCenterComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'users/edit/:id',
    component: AddUserComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'chart',
    loadChildren: () => import('./components/chart/chart.module').then(m => m.ChartModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { preload: true, roles: ['ADMIN'] }
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