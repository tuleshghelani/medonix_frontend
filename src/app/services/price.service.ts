import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  private apiUrl = `${environment.apiUrl}/api/price`;

  constructor(private http: HttpClient) {}

  getLatestPrices(data: { productId: number; customerId: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/latest`, data);
  }
} 