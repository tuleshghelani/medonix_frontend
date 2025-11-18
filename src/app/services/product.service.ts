import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product, ProductResponse, ProductSearchRequest } from '../models/product.model';
import { CacheService } from '../shared/services/cache.service';
import { EncryptionService } from '../shared/services/encryption.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly CACHE_KEY = 'active_products';
  private apiUrl = `${environment.apiUrl}/api/products`;

  constructor(
    private http: HttpClient, 
    private cacheService: CacheService,
    private encryptionService: EncryptionService
  ) {}

  searchProducts(params: ProductSearchRequest): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(`${this.apiUrl}/search`, params);
  }

  getProducts(params: ProductSearchRequest): Observable<any> {
    if (params.status === 'A') {
      const encryptedData = localStorage.getItem(this.CACHE_KEY);
      if (encryptedData) {
        const decryptedData = this.encryptionService.decrypt(encryptedData);
        if (decryptedData) {
          return of(decryptedData);
        }
      }
    }

    return this.http.post<any>(`${this.apiUrl}/getProducts`, {
      search: params.search,
      hsnCode: params.hsnCode,
      categoryId: params.categoryId,
      status: params.status
    }).pipe(
      tap(response => {
        if (params.status === 'A' && response.success) {
          const encryptedData = this.encryptionService.encrypt(response);
          localStorage.setItem(this.CACHE_KEY, encryptedData);
        }
      })
    );
  }

  refreshProducts(): Observable<any> {
    localStorage.removeItem(this.CACHE_KEY);
    return this.getProducts({ status: 'A' });
  }

  createProduct(product: Product): Observable<any> {
    return this.http.post(`${this.apiUrl}`, product);
  }

  updateProduct(id: number, product: Product): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  exportProducts(params: any): Observable<Blob> {
    const headers = new HttpHeaders({
      'Accept': 'application/pdf'
    });

    return this.http.post(`${this.apiUrl}/export-pdf`, params, {
      headers: headers,
      responseType: 'blob'
    });
  }
}