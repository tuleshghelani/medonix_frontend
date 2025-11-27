import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { formatDate } from '@angular/common';

import { SaleService } from '../../services/sale.service';
import { ProductService } from '../../services/product.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { EncryptionService } from '../../shared/services/encryption.service';

@Component({
  selector: 'app-add-sale-return',
  templateUrl: './add-sale-return.component.html',
  styleUrls: ['./add-sale-return.component.scss'],
  standalone: false
})
export class AddSaleReturnComponent implements OnInit, OnDestroy {
  returnForm: FormGroup;
  isLoading = false;
  isSaving = false;
  saleDetails: any;
  products: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private saleService: SaleService,
    private productService: ProductService,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService
  ) {
    this.returnForm = this.fb.group({
      saleId: [null],
      customerId: [null],
      saleReturnDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      invoiceNumber: ['', Validators.required],
      items: this.fb.array([])
    });
  }

  get itemsFormArray(): FormArray {
    return this.returnForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    const encryptedId = this.route.snapshot.paramMap.get('id');
    if (!encryptedId) {
      this.snackbar.error('Invalid sale id');
      return;
    }

    const decryptedId = this.encryptionService.decrypt(encryptedId);
    const id = decryptedId ? Number(decryptedId) : NaN;

    if (!id || isNaN(id)) {
      this.snackbar.error('Invalid sale id');
      return;
    }

    this.loadProducts();
    this.loadSaleDetails(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProducts(): void {
    this.productService.getProducts({ status: 'A' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (response?.success && response.data) {
          this.products = response.data.content || response.data;
        }
        this.mapProductNames();
      },
      error: () => {
        this.snackbar.error('Failed to load products');
      }
    });
  }

  getMaxReturnQuantity(group: AbstractControl): number {
    const quantity = Number(group.get('quantity')?.value || 0);
    const returnedQuantity = Number(group.get('returnedQuantity')?.value || 0);
    const max = quantity - returnedQuantity;
    return isNaN(max) || max < 0 ? 0 : max;
  }

  private loadSaleDetails(id: number): void {
    this.isLoading = true;
    this.saleService.getSaleDetails(id, true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.saleDetails = response;
        this.returnForm.patchValue({
          saleId: response.id,
          customerId: response.customerId,
          invoiceNumber: response.invoiceNumber ? `SR-${response.invoiceNumber}` : '',
        });

        const items = response.items || [];
        this.buildItemsForm(items);

        if (response.saleReturns) {
          this.applyExistingSaleReturns(response.saleReturns);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.snackbar.error(error?.error?.message || 'Failed to load sale details');
        this.isLoading = false;
      }
    });
  }

  private buildItemsForm(items: any[]): void {
    this.itemsFormArray.clear();

    items.forEach(item => {
      const quantity = Number(item.quantity || 0);
      const returnedQuantity = this.getReturnedQuantityForItem(item.id);
      const maxReturn = Math.max(0, quantity - returnedQuantity);

      const group = this.fb.group({
        saleItemId: [item.id],
        productId: [item.productId],
        productName: [null],
        quantity: [quantity],
        batchNumber: [item.batchNumber],
        unitPrice: [item.unitPrice],
        returnQuantity: [{ value: null, disabled: maxReturn <= 0 }, [
          Validators.min(0),
          Validators.max(maxReturn)
        ]],
        remarks: [null]
      });

      this.itemsFormArray.push(group);
    });

    this.mapProductNames();
  }

  private getReturnedQuantityForItem(saleItemId: number): number {
    if (!this.saleDetails?.saleReturns?.items) {
      return 0;
    }
    const returnItem = this.saleDetails.saleReturns.items.find((item: any) => item.saleItemId === saleItemId);
    return returnItem ? Number(returnItem.quantity || 0) : 0;
  }

  private applyExistingSaleReturns(saleReturns: any): void {
    if (!saleReturns) {
      return;
    }

    if (saleReturns.saleReturnDate) {
      const formattedDate = formatDate(saleReturns.saleReturnDate, 'yyyy-MM-dd', 'en');
      this.returnForm.get('saleReturnDate')?.setValue(formattedDate);
    }

    if (saleReturns.invoiceNumber) {
      this.returnForm.get('invoiceNumber')?.setValue(saleReturns.invoiceNumber);
    }

    const itemsBySaleItemId = new Map<number, any>();
    (saleReturns.items || []).forEach((item: any) => {
      if (item && item.saleItemId != null) {
        itemsBySaleItemId.set(item.saleItemId, item);
      }
    });

    this.itemsFormArray.controls.forEach(group => {
      const saleItemId = group.get('saleItemId')?.value;
      if (!saleItemId) {
        return;
      }

      const existing = itemsBySaleItemId.get(saleItemId);
      if (!existing) {
        return;
      }

      if (existing.quantity != null) {
        group.get('returnQuantity')?.setValue(existing.quantity, { emitEvent: false });
      }

      if (existing.unitPrice != null) {
        group.get('unitPrice')?.setValue(existing.unitPrice, { emitEvent: false });
      }

      if (existing.remarks != null) {
        group.get('remarks')?.setValue(existing.remarks, { emitEvent: false });
      }
    });
  }

  private mapProductNames(): void {
    if (!this.products || this.products.length === 0) {
      return;
    }

    this.itemsFormArray.controls.forEach(group => {
      const productId = group.get('productId')?.value;
      if (productId) {
        const product = this.products.find((p: any) => p.id === productId);
        if (product) {
          group.get('productName')?.setValue(product.name, { emitEvent: false });

          if (!group.get('unitPrice')?.value && product.unitPrice != null) {
            group.get('unitPrice')?.setValue(product.unitPrice, { emitEvent: false });
          }
        }
      }
    });
  }

  isReturnQuantityInvalid(index: number): boolean {
    const control = this.itemsFormArray.at(index).get('returnQuantity');
    if (!control || control.disabled) {
      return false;
    }
    return !!control.invalid;
  }

  getTotalReturnQuantity(): number {
    return this.itemsFormArray.controls.reduce((sum: number, group: AbstractControl) => {
      const control = group.get('returnQuantity');
      if (!control || control.disabled) {
        return sum;
      }

      const value = Number(control.value || 0);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  }

  onSubmit(): void {
    if (!this.saleDetails) {
      this.snackbar.error('Sale details not loaded');
      return;
    }

    if (this.returnForm.invalid) {
      this.returnForm.markAllAsTouched();
      return;
    }

    const rawValue = this.returnForm.getRawValue();

    const products = (rawValue.items || [])
      .filter((item: any) => {
        const qty = Number(item.returnQuantity || 0);
        return !isNaN(qty) && qty > 0;
      })
      .map((item: any) => ({
        productId: item.productId,
        quantity: Number(item.returnQuantity),
        unitPrice: item.unitPrice,
        saleItemId: item.saleItemId,
        remarks: item.remarks
      }));

    if (!products.length) {
      this.snackbar.error('Please enter at least one return quantity greater than 0');
      return;
    }

    const payload = {
      saleId: rawValue.saleId,
      saleReturnDate: formatDate(rawValue.saleReturnDate, 'dd-MM-yyyy', 'en'),
      invoiceNumber: rawValue.invoiceNumber,
      customerId: rawValue.customerId,
      products
    };

    this.isSaving = true;

    this.saleService.createSaleReturn(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.snackbar.success(res.message || 'Sale return created successfully');
          this.router.navigate(['/sale']);
        } else {
          this.snackbar.error(res?.message || 'Failed to create sale return');
        }
        this.isSaving = false;
      },
      error: (error: any) => {
        const message = error?.error?.message || 'Failed to create sale return';
        this.snackbar.error(message);
        this.isSaving = false;
      }
    });
  }
}
