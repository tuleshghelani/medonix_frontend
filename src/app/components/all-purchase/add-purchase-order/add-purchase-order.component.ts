import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { ProductService } from '../../../services/product.service';
import { PurchaseOrderService } from '../../../services/purchase-order.service';
import { CustomerService } from '../../../services/customer.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { PackagingChargesModalComponent } from '../../all-quotation/dispatch-quotation/packaging-charges-modal.component';

interface ProductForm {
  id?: number | null;
  productId: string;
  quantity: number;
  getQuantity?: number | null | string;
  unitPrice: number;
  price: number;
  taxPercentage: number;
  taxAmount: number;
  remarks: string
}

@Component({
  selector: 'app-add-purchase-order',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent,
    PackagingChargesModalComponent
  ],
  templateUrl: './add-purchase-order.component.html',
  styleUrls: ['./add-purchase-order.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddPurchaseOrderComponent implements OnInit, OnDestroy {
  purchaseOrderForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  isEdit = false;
  private destroy$ = new Subject<void>();
  private productSubscriptions: Subscription[] = [];
  private selectedItemIds = new Set<number>();
  showPackagingChargesModal = false;
  purchaseId?: number;
  productMap = new Map<number, any>();
  totalAmount = 0;
  totalTaxAmount = 0;
  grandTotal = 0;

  get productsFormArray() {
    return this.purchaseOrderForm.get('products') as FormArray;
  }

  trackByProductIndex(index: number, item: any): any {
    return item;
  }

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private customerService: CustomerService,
    private purchaseOrderService: PurchaseOrderService,
    private snackbar: SnackbarService,
    private http: HttpClient,
    private router: Router,
    private encryptionService: EncryptionService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
    this.loadCustomers();
    
    const encryptedId = localStorage.getItem('purchaseOrderId');
    if (encryptedId) {
      const purchaseOrderId = this.encryptionService.decrypt(encryptedId);
      if (purchaseOrderId) {
        this.fetchPurchaseOrderDetails(Number(purchaseOrderId));
      }
    }
  }

  ngOnDestroy() {
    // Unsubscribe from all product subscriptions
    this.productSubscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.productSubscriptions = [];

    // Complete destroy subject to clean up all takeUntil subscriptions
    this.destroy$.next();
    this.destroy$.complete();

    // Clear arrays to release memory
    this.products = [];
    this.customers = [];
    this.selectedItemIds.clear();

    // Reset form to release form subscriptions
    if (this.purchaseOrderForm) {
      this.purchaseOrderForm.reset();
    }
    this.productMap.clear();
  }

  private initForm() {
    this.purchaseOrderForm = this.fb.group({
      id: [null],
      customerId: ['', Validators.required],
      orderDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      invoiceNumber: [null],
      packagingAndForwadingCharges: [0, [Validators.required, Validators.min(0)]],
      products: this.fb.array([])
    });

    this.purchaseOrderForm.get('packagingAndForwadingCharges')?.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(300))
      .subscribe(() => {
        this.calculateTotalAmount();
        this.cdr.markForCheck();
      });

    // Add initial product form group
    this.addProduct();
  }

  private createProductFormGroup(): FormGroup {
    return this.fb.group({
      id: [null], // Item ID for updates
      productId: ['', Validators.required],
      quantity: ['', [Validators.required, Validators.min(1)]],
      getQuantity: [null, [this.getQuantityValidator()]],
      unitPrice: ['', [Validators.required, Validators.min(0.01)]],
      price: [{ value: 0, disabled: true }],
      taxPercentage: [{ value: 0, disabled: true }],
      taxAmount: [{ value: 0, disabled: true }],
      remarks:[null, []],
      purchaseId: [null] // Purchase ID if this item has been converted to purchase
    });
  }

  addProduct() {
    const productGroup = this.createProductFormGroup();
    const subscription = this.setupProductCalculations(productGroup);
    this.productSubscriptions.push(subscription);
    this.productsFormArray.push(productGroup);
  }

  removeProduct(index: number): void {
    if (this.productsFormArray.length === 1) return;
    
    // Unsubscribe from the removed product's subscription bundle
    if (this.productSubscriptions[index]) {
      this.productSubscriptions[index].unsubscribe();
      this.productSubscriptions.splice(index, 1);
    }
    
    this.productsFormArray.removeAt(index);
    this.calculateTotalAmount();
    this.cdr.markForCheck();
  }

  // Memory optimization: build Map for O(1) product lookups
  private buildProductMap(): void {
    this.productMap.clear();
    for (const product of this.products) {
      this.productMap.set(product.id, product);
    }
  }

  private setupProductCalculations(group: FormGroup): Subscription {
    const compositeSubscription = new Subscription();

    // Listen to product selection to get tax percentage and purchaseAmount
    const productIdSubscription = group.get('productId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(150),
        distinctUntilChanged()
      )
      .subscribe((productId) => {
        if (productId) {
          const selectedProduct = this.productMap.get(productId);
          if (selectedProduct) {
            const taxPercentage = selectedProduct.taxPercentage || 0;
            const unitPrice = selectedProduct.purchaseAmount || 0;
            group.patchValue({ taxPercentage, unitPrice }, { emitEvent: false });
            this.calculateProductPrice(group);
          }
        }
      });

    // Keep getQuantity in sync with quantity for validation
    const quantityControl = group.get('quantity');
    const quantitySubscription = quantityControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        group.get('getQuantity')?.updateValueAndValidity({ emitEvent: false });
      });

    // Listen to quantity and unitPrice changes
    const valueSubscription = group.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(150)
      )
      .subscribe(() => {
        this.calculateProductPrice(group);
      });
    
    if (productIdSubscription) {
      compositeSubscription.add(productIdSubscription);
    }
    if (quantitySubscription) {
      compositeSubscription.add(quantitySubscription);
    }
    compositeSubscription.add(valueSubscription);
    
    return compositeSubscription;
  }

  private calculateProductPrice(group: FormGroup): void {
    if (!group) return;

    const quantity = Number(group.get('quantity')?.value || 0);
    const unitPrice = Number(group.get('unitPrice')?.value || 0);
    const taxPercentage = Number(group.get('taxPercentage')?.value || 0);
    
    // Calculate price = unitPrice * quantity
    const price = Number((quantity * unitPrice).toFixed(2));
    
    // Calculate taxAmount = (price * taxPercentage) / 100
    const taxAmount = Number((price * taxPercentage / 100).toFixed(2));

    group.patchValue({
      price: price,
      taxAmount: taxAmount
    }, { emitEvent: false });

    this.calculateTotalAmount();
    this.cdr.markForCheck();
  }

  getTotalAmount(): number {
    return this.productsFormArray.controls
      .reduce((total, group: any) => total + (group.get('price').value || 0), 0);
  }

  getTotalTaxAmount(): number {
    return this.productsFormArray.controls
      .reduce((total, group: any) => total + (group.get('taxAmount').value || 0), 0);
  }

  getGrandTotal(): number {
    const packagingCharges = Number(this.purchaseOrderForm.get('packagingAndForwadingCharges')?.value || 0);
    return this.getTotalAmount() + this.getTotalTaxAmount() + packagingCharges;
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.products = response.data;
            this.buildProductMap();
          }
          this.isLoadingProducts = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.snackbar.error('Failed to load products');
          this.isLoadingProducts = false;
          this.cdr.markForCheck();
        }
      });
  }

  refreshProducts(): void {
    this.isLoadingProducts = true;
    this.productService.refreshProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.products = response.data;
            this.buildProductMap();
            this.snackbar.success('Products refreshed successfully');
          }
          this.isLoadingProducts = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.snackbar.error('Failed to refresh products');
          this.isLoadingProducts = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.customers = response.data;
          }
          this.isLoadingCustomers = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.snackbar.error('Failed to load customers');
          this.isLoadingCustomers = false;
          this.cdr.markForCheck();
        }
      });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.customers = response.data;
          }
          this.snackbar.success('Customers refreshed successfully');
          this.isLoadingCustomers = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.snackbar.error('Failed to refresh customers');
          this.isLoadingCustomers = false;
          this.cdr.markForCheck();
        }
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.purchaseOrderForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  isProductFieldInvalid(index: number, fieldName: string): boolean {
    const control = this.productsFormArray.at(index).get(fieldName);
    if (!control) return false;

    const isInvalid = control.invalid && (control.dirty || control.touched);
    
    if (isInvalid) {
      const errors = control.errors;
      if (errors) {
        if (errors['required']) return true;
        if (errors['min'] && fieldName === 'quantity') return true;
        if (errors['min'] && fieldName === 'unitPrice') return true;
        if (errors['min'] || errors['max'] || errors['maxQuantity']) return true;
        if (errors['min']) return true;
      }
    }
    
    return false;
  }

  resetForm() {
    this.isEdit = false;
    this.purchaseOrderForm.patchValue({ id: null });
    this.initForm();
  }

  onSubmit() {
    this.markFormGroupTouched(this.purchaseOrderForm);
    
    if (this.purchaseOrderForm.valid) {
      this.loading = true;
      this.cdr.markForCheck(); // Show loader immediately
      
      const formData = this.preparePurchaseOrderData();
      
      const serviceCall = this.isEdit 
        ? this.purchaseOrderService.updatePurchaseOrder(formData)
        : this.purchaseOrderService.createPurchaseOrder(formData);
      
      serviceCall
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            if (response?.success) {
              this.snackbar.success(`Purchase Order ${this.isEdit ? 'updated' : 'created'} successfully`);
              localStorage.removeItem('purchaseOrderId');
              this.router.navigate(['/purchase-order']);
            }
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || `Failed to ${this.isEdit ? 'update' : 'create'} purchase order`);
            this.loading = false;
            this.cdr.markForCheck();
          }
        });
    } else {
      // Scroll to first error
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  private preparePurchaseOrderData() {
    const formValue = this.purchaseOrderForm.value;
    const data: any = {
      orderDate: formatDate(formValue.orderDate, 'dd-MM-yyyy', 'en'),
      customerId: formValue.customerId,
      invoiceNumber: formValue.invoiceNumber,
      packagingAndForwadingCharges: Number(formValue.packagingAndForwadingCharges || 0),
      products: formValue.products.map((product: ProductForm, index: number) => {
        const itemId = this.productsFormArray.at(index).get('id')?.value;
        const item: any = {
          productId: Number(product.productId),
          quantity: Number(product.quantity),
          unitPrice: Number(product.unitPrice),
          getQuantity: product.getQuantity === null || product.getQuantity === undefined || product.getQuantity === '' 
            ? null 
            : Number(product.getQuantity),
          remarks: product.remarks || ''
        };
        // Include item id when updating
        if (this.isEdit && itemId) {
          item.id = itemId;
        }
        return item;
      })
    };
    
    // Include id only when updating
    if (this.isEdit && formValue.id) {
      data.id = formValue.id;
    }
    
    return data;
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
        control.markAsDirty();
      }
    });
  }

  private calculateTotalAmount(): void {
    const totalPrice = this.productsFormArray.controls
      .reduce((sum, group: any) => sum + (group.get('price').value || 0), 0);
    
    const totalTaxAmount = this.productsFormArray.controls
      .reduce((sum, group: any) => sum + (group.get('taxAmount').value || 0), 0);
      
    const packagingCharges = Number(this.purchaseOrderForm.get('packagingAndForwadingCharges')?.value || 0);
    this.totalAmount = totalPrice;
    this.totalTaxAmount = totalTaxAmount;
    this.grandTotal = totalPrice + totalTaxAmount + packagingCharges;

    this.purchaseOrderForm.patchValue({ 
      price: totalPrice,
      taxAmount: totalTaxAmount,
      totalAmount: this.grandTotal 
    }, { emitEvent: false });
  }

  getFormattedPrice(index: number): string {
    const price = this.productsFormArray.at(index).get('price')?.value;
    return price ? price.toFixed(2) : '0.00';
  }

  getFormattedTaxAmount(index: number): string {
    const taxAmount = this.productsFormArray.at(index).get('taxAmount')?.value;
    return taxAmount ? taxAmount.toFixed(2) : '0.00';
  }

  private fetchPurchaseOrderDetails(id: number, setLoading: boolean = false): void {
    if (setLoading) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    this.purchaseOrderService.getPurchaseOrderDetails(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.id) {
            this.isEdit = true;
            // Store purchaseId if available in response
            if (response.purchaseId) {
              this.purchaseId = response.purchaseId;
            }
            this.populateForm(response);
          }
          if (setLoading) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to load purchase order details');
          if (setLoading) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        }
      });
  }

  private populateForm(data: any): void {
    // Clear existing subscriptions before repopulating
    this.productSubscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.productSubscriptions = [];

    this.purchaseOrderForm.patchValue({
      customerId: data.customerId,
      id: data.id,
      orderDate: formatDate(new Date(data.orderDate), 'yyyy-MM-dd', 'en'),
      invoiceNumber: data.invoiceNumber,
      packagingAndForwadingCharges: data.packagingAndForwadingCharges || 0,
    });

    // Clear existing products
    this.productsFormArray.clear();

    // Populate products - handle both 'products' and 'items' from API response
    const productsArray = data.products || data.items || [];
    productsArray.forEach((item: any) => {
      const productGroup = this.createProductFormGroup();
      const subscription = this.setupProductCalculations(productGroup);
      this.productSubscriptions.push(subscription);
      
      // Calculate price and tax if not provided
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const price = item.price || (quantity * unitPrice);
      const taxPercentage = item.taxPercentage || 0;
      const taxAmount = item.taxAmount || (price * taxPercentage / 100);
      
      productGroup.patchValue({
        id: item.id, // Store item ID for updates
        productId: item.productId,
        quantity: quantity,
        getQuantity: item.getQuantity ?? null,
        unitPrice: unitPrice,
        price: price,
        taxPercentage: taxPercentage,
        taxAmount: taxAmount,
        remarks: item.remarks || '',
        purchaseId: item.purchaseId || null // Store purchaseId if item has been converted
      }, { emitEvent: false });

      // Disable form controls if purchaseId exists (either at order level or item level)
      const itemPurchaseId = item.purchaseId || null;
      if (this.purchaseId || itemPurchaseId) {
        productGroup.get('productId')?.disable();
        productGroup.get('quantity')?.disable();
        productGroup.get('unitPrice')?.disable();
        productGroup.get('remarks')?.disable();
      }

      this.productsFormArray.push(productGroup);
    });
    this.isEdit = true;
    this.calculateTotalAmount();
    this.cdr.markForCheck();
  }

  // Selection helpers for converting to purchase
  private getItemIdByIndex(index: number): number | null {
    const group = this.productsFormArray.at(index) as FormGroup;
    const id = group?.get('id')?.value;
    return typeof id === 'number' ? id : null;
  }

  isSelected(index: number): boolean {
    const id = this.getItemIdByIndex(index);
    if (!id) return false;
    return this.selectedItemIds.has(id);
  }

  toggleSelection(index: number, event: Event): void {
    const id = this.getItemIdByIndex(index);
    if (!id) return;
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      this.selectedItemIds.add(id);
    } else {
      this.selectedItemIds.delete(id);
    }
  }

  hasSelection(): boolean {
    return this.selectedItemIds.size > 0;
  }

  convertToPurchase(): void {
    const orderId = this.purchaseOrderForm.get('id')?.value;
    if (!orderId) {
      this.snackbar.error('Purchase order ID not found');
      return;
    }

    // Check if any items are selected
    if (!this.hasSelection()) {
      this.snackbar.error('Please select at least one item to convert to purchase');
      return;
    }

    // Show packaging charges modal before converting (as per requirement, matching dispatch-quotation behavior)
    this.showPackagingChargesModal = true;
  }

  onPackagingChargesConfirm(data: number | { id: number; invoiceNumber: string; packagingAndForwadingCharges: number }): void {
    this.showPackagingChargesModal = false;
    
    // Get selected item IDs
    const purchaseOrderItemIds = Array.from(this.selectedItemIds);
    
    if (purchaseOrderItemIds.length === 0) {
      this.snackbar.error('Please select at least one item to convert to purchase');
      return;
    }
    
    // Handle both number (backward compatibility) and object (new format with invoice number)
    let requestBody: { id: number; invoiceNumber: string; packagingAndForwadingCharges: number; purchaseOrderItemIds: number[] };
    
    if (typeof data === 'object' && data.id !== undefined) {
      // New format: object with id, invoiceNumber (from user input), and packagingAndForwadingCharges
      requestBody = {
        ...data,
        purchaseOrderItemIds: purchaseOrderItemIds
      };
    } else {
      // Fallback: use form values if number is passed (shouldn't happen but for safety)
      const orderId = this.purchaseOrderForm.get('id')?.value;
      const invoiceNumber = this.purchaseOrderForm.get('invoiceNumber')?.value;
      
      if (!orderId) {
        this.snackbar.error('Purchase order ID not found');
        return;
      }

      requestBody = {
        id: orderId,
        invoiceNumber: invoiceNumber || '',
        packagingAndForwadingCharges: typeof data === 'number' ? data : 0,
        purchaseOrderItemIds: purchaseOrderItemIds
      };
    }

    if (!requestBody.id) {
      this.snackbar.error('Purchase order ID not found');
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.purchaseOrderService.convertToPurchase(requestBody)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.success) {
            this.snackbar.success(response?.message || 'Purchase order converted to purchase successfully');
            if (response?.data?.purchaseId) {
              this.purchaseId = response.data.purchaseId;
            }
            // Clear selections after successful conversion
            this.selectedItemIds.clear();
            // Refresh the component to reload purchase order details with updated purchaseId
            this.fetchPurchaseOrderDetails(requestBody.id, true);
          } else {
            this.snackbar.error(response?.message || 'Failed to convert purchase order to purchase');
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to convert purchase order to purchase');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onPackagingChargesCancel(): void {
    this.showPackagingChargesModal = false;
  }

  private disableProductFormControls(): void {
    // Disable all product form controls when purchaseId exists
    this.productsFormArray.controls.forEach((control) => {
      const productGroup = control as FormGroup;
      productGroup.get('productId')?.disable();
      productGroup.get('quantity')?.disable();
      productGroup.get('unitPrice')?.disable();
      productGroup.get('remarks')?.disable();
    });
  }

  onGetQuantityFocus(index: number): void {
    const control = this.productsFormArray.at(index).get('getQuantity');
    if (control && control.value === null) {
      control.setValue('', { emitEvent: false });
    }
  }

  onGetQuantityChange(index: number, event: Event): void {
    const control = this.productsFormArray.at(index).get('getQuantity');
    const quantity = Number(this.productsFormArray.at(index).get('quantity')?.value || 0);
    const input = event.target as HTMLInputElement;
    const rawValue = input.value;

    if (!rawValue) {
      control?.setValue(null, { emitEvent: false });
      control?.updateValueAndValidity();
      this.syncGetQuantityToServer(index, null);
      return;
    }

    const value = Number(rawValue);
    if (isNaN(value) || value < 0) {
      control?.setValue(0, { emitEvent: false });
      control?.updateValueAndValidity();
      this.syncGetQuantityToServer(index, 0);
      return;
    }

    if (value > quantity) {
      control?.setValue(quantity, { emitEvent: false });
      control?.updateValueAndValidity();
      this.snackbar.warning('Get Quantity cannot exceed Quantity');
      this.syncGetQuantityToServer(index, quantity);
      return;
    }

    control?.setValue(value, { emitEvent: false });
    control?.updateValueAndValidity();
    this.syncGetQuantityToServer(index, value);
  }

  private syncGetQuantityToServer(index: number, getQuantity: number | null): void {
    const group = this.productsFormArray.at(index) as FormGroup;
    if (!this.isEdit) return;

    const itemId = group.get('id')?.value;
    if (!itemId) return;

    this.purchaseOrderService.updatePurchaseOrderItemGetQuantity({
      id: itemId,
      getQuantity: getQuantity === null ? null : Number(getQuantity)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.success === false) {
            this.snackbar.error(response?.message || 'Failed to update Get Quantity');
          }
        },
        error: () => {
          this.snackbar.error('Failed to update Get Quantity');
        }
      });
  }

  private getQuantityValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value === null || value === undefined || value === '') {
        return null;
      }
      return null;
    };
  }
}
