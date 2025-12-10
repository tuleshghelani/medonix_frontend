import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { formatDate } from '@angular/common';

import { PurchaseService } from '../../../services/purchase.service';
import { ProductService } from '../../../services/product.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-add-purchase-return',
  templateUrl: './add-purchase-return.component.html',
  styleUrls: ['./add-purchase-return.component.scss']
})
export class AddPurchaseReturnComponent {
  returnForm: FormGroup;
  isLoading = false;
  isSaving = false;
  purchaseDetails: any;
  products: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService
  ) {
    this.returnForm = this.fb.group({
      purchaseId: [null],
      customerId: [null],
      purchaseReturnDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      invoiceNumber: [''],
      packagingAndForwadingCharges: [0, [Validators.required, Validators.min(0)]],
      items: this.fb.array([])
    });
  }

  get itemsFormArray(): FormArray {
    return this.returnForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    const encryptedId = this.route.snapshot.paramMap.get('id');
    if (!encryptedId) {
      this.snackbar.error('Invalid purchase id');
      return;
    }

    const decryptedId = this.encryptionService.decrypt(encryptedId);
    const id = decryptedId ? Number(decryptedId) : NaN;

    if (!id || isNaN(id)) {
      this.snackbar.error('Invalid purchase id');
      return;
    }

    this.loadProducts();
    this.loadPurchaseDetails(id);
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
    const qcPass = Number(group.get('qcPass')?.value || 0);
    const max = quantity - qcPass;
    return isNaN(max) || max < 0 ? 0 : max;
  }

  private loadPurchaseDetails(id: number): void {
    this.isLoading = true;
    this.purchaseService.getPurchaseDetails(id, true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.purchaseDetails = response;
        this.returnForm.patchValue({
          purchaseId: response.id,
          customerId: response.customerId,
          invoiceNumber: response.invoiceNumber ? `PR-${response.invoiceNumber}` : '',
          isPurchaseReturn: true,
          packagingAndForwadingCharges: response.packagingAndForwadingCharges || 0
        });

        const items = response.items || [];
        this.buildItemsForm(items);

        if (response.purchaseReturns) {
          this.applyExistingPurchaseReturns(response.purchaseReturns);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.snackbar.error(error?.error?.message || 'Failed to load purchase details');
        this.isLoading = false;
      }
    });
  }

  private buildItemsForm(items: any[]): void {
    this.itemsFormArray.clear();

    items.forEach(item => {
      const quantity = Number(item.quantity || 0);
      const qcPass = Number(item.qcPass || 0);
      const maxReturn = Math.max(0, quantity - qcPass);

      const group = this.fb.group({
        purchaseItemId: [item.id],
        productId: [item.productId],
        productName: [null],
        quantity: [quantity],
        batchNumber: [item.batchNumber],
        qcPass: [qcPass],
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

  private applyExistingPurchaseReturns(purchaseReturns: any): void {
    if (!purchaseReturns) {
      return;
    }

    if (purchaseReturns.purchaseReturnDate) {
      const formattedDate = formatDate(purchaseReturns.purchaseReturnDate, 'yyyy-MM-dd', 'en');
      this.returnForm.get('purchaseReturnDate')?.setValue(formattedDate);
    }

    if (purchaseReturns.invoiceNumber) {
      this.returnForm.get('invoiceNumber')?.setValue(purchaseReturns.invoiceNumber);
    }

    if (purchaseReturns.packagingAndForwadingCharges != null) {
      this.returnForm.get('packagingAndForwadingCharges')?.setValue(purchaseReturns.packagingAndForwadingCharges);
    }

    const itemsByPurchaseItemId = new Map<number, any>();
    (purchaseReturns.items || []).forEach((item: any) => {
      if (item && item.purchaseItemId != null) {
        itemsByPurchaseItemId.set(item.purchaseItemId, item);
      }
    });

    this.itemsFormArray.controls.forEach(group => {
      const purchaseItemId = group.get('purchaseItemId')?.value;
      if (!purchaseItemId) {
        return;
      }

      const existing = itemsByPurchaseItemId.get(purchaseItemId);
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
    if (!this.purchaseDetails) {
      this.snackbar.error('Purchase details not loaded');
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
        purchaseItemId: item.purchaseItemId,
        productId: item.productId,
        quantity: Number(item.returnQuantity),
        unitPrice: item.unitPrice,
        remarks: item.remarks
      }));

    if (!products.length) {
      this.snackbar.error('Please enter at least one return quantity greater than 0');
      return;
    }

    const existingReturnId = this.purchaseDetails?.purchaseReturns?.id ?? null;

    const payload = {
      id: existingReturnId,
      purchaseId: rawValue.purchaseId,
      customerId: rawValue.customerId,
      purchaseReturnDate: formatDate(rawValue.purchaseReturnDate, 'dd-MM-yyyy', 'en'),
      invoiceNumber: rawValue.invoiceNumber,
      packagingAndForwadingCharges: Number(rawValue.packagingAndForwadingCharges || 0),
      products
    };

    this.isSaving = true;

    this.purchaseService.createPurchaseReturn(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.snackbar.success(res.message || 'Purchase return created successfully');
        } else {
          this.snackbar.error(res?.message || 'Failed to create purchase return');
        }
        this.isSaving = false;
      },
      error: (error: any) => {
        const message = error?.error?.message || 'Failed to create purchase return';
        this.snackbar.error(message);
        this.isSaving = false;
      }
    });
  }
}
