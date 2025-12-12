import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { ProductService } from '../../../services/product.service';
import { PurchaseChallanService } from '../../../services/purchase-challan.service';
import { CustomerService } from '../../../services/customer.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { EncryptionService } from '../../../shared/services/encryption.service';

interface ProductForm {
  id?: number | null;
  productId: string;
  quantity: number;
  batchNumber: string;
  unitPrice: number;
  price: number;
  taxPercentage: number;
  taxAmount: number;
  remarks: string
}

@Component({
  selector: 'app-add-purchase-challan',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent
  ],
  templateUrl: './add-purchase-challan.component.html',
  styleUrls: ['./add-purchase-challan.component.scss']
})
export class AddPurchaseChallanComponent implements OnInit, OnDestroy {
  purchaseChallanForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  isEdit = false;
  private destroy$ = new Subject<void>();
  private productSubscriptions: Subscription[] = [];

  get productsFormArray() {
    return this.purchaseChallanForm.get('products') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private customerService: CustomerService,
    private purchaseChallanService: PurchaseChallanService,
    private snackbar: SnackbarService,
    private http: HttpClient,
    private router: Router,
    private encryptionService: EncryptionService
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
    this.loadCustomers();
    
    const encryptedId = localStorage.getItem('purchaseChallanId');
    if (encryptedId) {
      const purchaseChallanId = this.encryptionService.decrypt(encryptedId);
      if (purchaseChallanId) {
        this.fetchPurchaseChallanDetails(Number(purchaseChallanId));
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

    // Reset form to release form subscriptions
    if (this.purchaseChallanForm) {
      this.purchaseChallanForm.reset();
    }
  }

  private initForm() {
    this.purchaseChallanForm = this.fb.group({
      id: [null],
      customerId: ['', Validators.required],
      challanDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      invoiceNumber: ['', Validators.required],
      packagingAndForwadingCharges: [0, [Validators.required, Validators.min(0)]],
      products: this.fb.array([])
    });

    // Add initial product form group
    this.addProduct();
  }

  private createProductFormGroup(): FormGroup {
    return this.fb.group({
      id: [null], // Item ID for updates
      productId: ['', Validators.required],
      quantity: ['', [Validators.required, Validators.min(1)]],
      batchNumber: ['', [this.noDoubleQuotesValidator()]],
      unitPrice: ['', [Validators.required, Validators.min(0.01)]],
      price: [{ value: 0, disabled: true }],
      taxPercentage: [{ value: 0, disabled: true }],
      taxAmount: [{ value: 0, disabled: true }],
      remarks:[null, []]
    });
  }

  addProduct() {
    const productGroup = this.createProductFormGroup();
    this.setupProductCalculations(productGroup, this.productsFormArray.length);
    this.productsFormArray.push(productGroup);
  }

  removeProduct(index: number): void {
    if (this.productsFormArray.length === 1) return;
    
    // Unsubscribe from the removed product's subscription
    if (this.productSubscriptions[index]) {
      this.productSubscriptions[index].unsubscribe();
      this.productSubscriptions.splice(index, 1);
    }
    
    this.productsFormArray.removeAt(index);
    
    // Resubscribe remaining products with correct indices
    this.productsFormArray.controls.forEach((control, newIndex) => {
      if (this.productSubscriptions[newIndex]) {
        this.productSubscriptions[newIndex].unsubscribe();
      }
      this.setupProductCalculations(control as FormGroup, newIndex);
    });

    this.calculateTotalAmount();
  }

  private setupProductCalculations(group: FormGroup, index: number) {
    // Listen to product selection to get tax percentage and purchaseAmount
    const productIdSubscription = group.get('productId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((productId) => {
        if (productId) {
          const selectedProduct = this.products.find(p => p.id === productId);
          if (selectedProduct) {
            const taxPercentage = selectedProduct.taxPercentage || 0;
            const unitPrice = selectedProduct.purchaseAmount || 0;
            group.patchValue({ taxPercentage, unitPrice }, { emitEvent: false });
            this.calculateProductPrice(index);
          }
        }
      });

    // Listen to quantity and unitPrice changes
    const valueSubscription = group.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculateProductPrice(index);
      });
    
    this.productSubscriptions[index] = valueSubscription;
  }

  private calculateProductPrice(index: number): void {
    const group = this.productsFormArray.at(index) as FormGroup;
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
    const packagingCharges = Number(this.purchaseChallanForm.get('packagingAndForwadingCharges')?.value || 0);
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
          }
          this.isLoadingProducts = false;
        },
        error: (error) => {
          this.snackbar.error('Failed to load products');
          this.isLoadingProducts = false;
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
            this.snackbar.success('Products refreshed successfully');
          }
          this.isLoadingProducts = false;
        },
        error: (error) => {
          this.snackbar.error('Failed to refresh products');
          this.isLoadingProducts = false;
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
        },
        error: (error) => {
          this.snackbar.error('Failed to load customers');
          this.isLoadingCustomers = false;
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
        },
        error: (error) => {
          this.snackbar.error('Failed to refresh customers');
          this.isLoadingCustomers = false;
        }
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.purchaseChallanForm.get(fieldName);
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
        if (errors['min'] || errors['max']) return true;
        if (errors['min']) return true;
      }
    }
    
    return false;
  }

  resetForm() {
    this.isEdit = false;
    this.purchaseChallanForm.patchValue({ id: null });
    this.initForm();
  }

  onSubmit() {
    this.markFormGroupTouched(this.purchaseChallanForm);
    
    if (this.purchaseChallanForm.valid) {
      this.loading = true;
      const formData = this.preparePurchaseChallanData();
      
      const serviceCall = this.isEdit 
        ? this.purchaseChallanService.updatePurchaseChallan(formData)
        : this.purchaseChallanService.createPurchaseChallan(formData);
      
      serviceCall
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            if (response?.success) {
              this.snackbar.success(`Purchase Challan ${this.isEdit ? 'updated' : 'created'} successfully`);
              localStorage.removeItem('purchaseChallanId');
              this.router.navigate(['/purchase-challan']);
            }
            this.loading = false;
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || `Failed to ${this.isEdit ? 'update' : 'create'} purchase challan`);
            this.loading = false;
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

  private preparePurchaseChallanData() {
    const formValue = this.purchaseChallanForm.value;
    const data: any = {
      challanDate: formatDate(formValue.challanDate, 'dd-MM-yyyy', 'en'),
      customerId: formValue.customerId,
      invoiceNumber: formValue.invoiceNumber,
      price: this.getTotalAmount(),
      taxAmount: this.getTotalTaxAmount(),
      packagingAndForwadingCharges: Number(formValue.packagingAndForwadingCharges || 0),
      products: formValue.products.map((product: ProductForm, index: number) => {
        const itemId = this.productsFormArray.at(index).get('id')?.value;
        const item: any = {
          productId: product.productId,
          quantity: product.quantity,
          batchNumber: product.batchNumber,
          unitPrice: product.unitPrice,
          price: this.productsFormArray.at(index).get('price')?.value,
          taxPercentage: this.productsFormArray.at(index).get('taxPercentage')?.value,
          taxAmount: this.productsFormArray.at(index).get('taxAmount')?.value,
          remarks: product.remarks
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
      
    this.purchaseChallanForm.patchValue({ 
      price: totalPrice,
      taxAmount: totalTaxAmount,
      totalAmount: totalPrice + totalTaxAmount 
    }, { emitEvent: false });
  }

  private noDoubleQuotesValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      return control.value.includes('"') ? { doubleQuotes: true } : null;
    };
  }

  getFormattedPrice(index: number): string {
    const price = this.productsFormArray.at(index).get('price')?.value;
    return price ? price.toFixed(2) : '0.00';
  }

  getFormattedTaxAmount(index: number): string {
    const taxAmount = this.productsFormArray.at(index).get('taxAmount')?.value;
    return taxAmount ? taxAmount.toFixed(2) : '0.00';
  }

  private fetchPurchaseChallanDetails(id: number): void {
    this.purchaseChallanService.getPurchaseChallanDetails(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.id) {
            this.isEdit = true;
            this.populateForm(response);
          }
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to load purchase challan details');
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

    this.purchaseChallanForm.patchValue({
      customerId: data.customerId,
      id: data.id,
      challanDate: formatDate(new Date(data.challanDate), 'yyyy-MM-dd', 'en'),
      invoiceNumber: data.invoiceNumber,
      packagingAndForwadingCharges: data.packagingAndForwadingCharges || 0,
    });

    // Clear existing products
    this.productsFormArray.clear();

    // Populate products
    data.items.forEach((item: any, index: number) => {
      const productGroup = this.createProductFormGroup();
      this.setupProductCalculations(productGroup, index);
      productGroup.patchValue({
        id: item.id, // Store item ID for updates
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        price: item.price,
        taxPercentage: item.taxPercentage,
        taxAmount: item.taxAmount,
        batchNumber: item.batchNumber,
        remarks: item.remarks
      }, { emitEvent: false });
      this.productsFormArray.push(productGroup);
    });
    this.isEdit = true;
  }

}

