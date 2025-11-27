import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/auth/login/login.component';
import { HeaderComponent } from './components/shared/header/header.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { AppRoutingModule } from './app-routing.module';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { RoundPipe } from './round.pipe';
import { DataCenterComponent } from './components/data-center/data-center.component';
import { AddDealerComponent } from './components/dealers/add-dealer/add-dealer.component';
import { AddSaleReturnComponent } from './components/add-sale-return/add-sale-return.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HeaderComponent,
    AddDealerComponent,
    AddSaleReturnComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AppRoutingModule,
    ToastrModule.forRoot(),
    // LoaderComponent,
    // DataCenterComponent
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }