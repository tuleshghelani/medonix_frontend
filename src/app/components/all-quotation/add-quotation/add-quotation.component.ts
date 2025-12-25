import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl, AbstractControl, ValidatorFn, ValidationErrors, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, Subscription, finalize, debounceTime, filter, distinctUntilChanged } from 'rxjs';
import { formatDate } from '@angular/common';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { QuotationService } from '../../../services/quotation.service';
import { PriceService } from '../../../services/price.service';
import { SearchableSelectComponent } from "../../../shared/components/searchable-select/searchable-select.component";
import { MatDialogModule } from '@angular/material/dialog';

import { LoaderComponent } from '../../../shared/components/loader/loader.component';

import { TransportMaster, TransportMasterService } from '../../../services/transport-master.service';
import { QuotationItemStatus } from '../../../models/quotation.model copy';

@Component({
  standalone: true,
  selector: 'app-add-quotation',
  templateUrl: './add-quotation.component.html',
  styleUrl: './add-quotation.component.scss',
  imports: [SearchableSelectComponent, 
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    RouterModule, MatDialogModule, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddQuotationComponent implements OnInit, OnDestroy {
  quotationForm!: FormGroup;
  createQuotationForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  transports: TransportMaster[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  isLoadingTransports = false;
  minValidUntilDate: string;
  private destroy$ = new Subject<void>();
  isLoading = false;
  isEdit = false;
  quotationId?: number;
  selectedProduct!: string
  totals: { price: number; tax: number; finalPrice: number; taxPercentage: number; afterQuotationDiscount: number; quotationDiscountAmount: number } = {
    price: 0,
    tax: 0,
    finalPrice: 0,
    taxPercentage: 0,
    afterQuotationDiscount: 0,
    quotationDiscountAmount: 0
  };
  private itemSubscriptions: Subscription[] = [];
  private productPriceCache: Map<string, number> = new Map();
  // Memory optimization: Map for O(1) product lookups
  private productMap: Map<any, any> = new Map();
  isLoadingPrices: { [key: number]: boolean } = {};

  get itemsFormArray() {
    return this.quotationForm.get('items') as FormArray;
  }

  trackByItemIndex(index: number, item: any): any {
    return item;
  }

  constructor(
    private fb: FormBuilder,
    private quotationService: QuotationService,
    private productService: ProductService,
    private customerService: CustomerService,
    private transportService: TransportMasterService,
    private priceService: PriceService,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService,
    private router: Router,
    private dialog: Dialog,
    private cdr: ChangeDetectorRef
  ) {
    const today = new Date();
    this.minValidUntilDate = formatDate(today, 'yyyy-MM-dd', 'en');
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
    this.loadCustomers();
    this.loadTransports();
    this.setupCustomerNameSync();
    this.setupCustomerChangeListener();
    this.checkForEdit();
    this.checkForEdit();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.itemSubscriptions.forEach(sub => sub?.unsubscribe());
    this.itemSubscriptions = [];

    // Clear Map to help with garbage collection
    this.productPriceCache.clear();
    this.productMap.clear();

    // Clear arrays
    this.products = [];
    this.customers = [];
    this.transports = [];
  }

  private initForm() {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 7);

    this.quotationForm = this.fb.group({
      customerId: [''],
      customerName: ['', Validators.required],
      referenceName: [''],
      contactNumber: ['', Validators.required],
      quoteDate: [formatDate(today, 'yyyy-MM-dd', 'en')],
      validUntil: [formatDate(validUntil, 'yyyy-MM-dd', 'en'), [Validators.required]],
      remarks: [''],
      termsConditions: [''],
      items: this.fb.array([]),
      address: [''],
      quotationDiscountPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      transportMasterId: [null],
      caseNumber: [''],
      packagingAndForwadingCharges: [0, [Validators.required, Validators.min(0)]]
    });

    this.addItem(true);
    
    this.quotationForm.get('quotationDiscountPercentage')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100)
      )
      .subscribe(newValue => {
        // console.log('Quotation discount percentage changed to:', newValue);
        this.itemsFormArray.controls.forEach((_, index) => {
          this.calculateItemPrice(index);
        });
        this.calculateTotalAmount();
        this.cdr.detectChanges();
      });

    // Recalculate totals when packagingAndForwadingCharges changes
    this.quotationForm.get('packagingAndForwadingCharges')?.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe(() => {
        this.calculateTotalAmount();
        this.cdr.detectChanges();
      });
  }

  private createItemFormGroup(initialData?: any): FormGroup {
    return this.fb.group({
      id: [initialData?.id || ''],
      productId: [initialData?.productId || '', Validators.required],
      productType: [initialData?.productType || ''],
      quantity: [initialData?.quantity || 1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [initialData?.unitPrice || 0, [Validators.required, Validators.min(0.01)]],
      quotationItemStatus: [initialData?.quotationItemStatus || null],
      remarks: [initialData?.remarks || ''],
      price: [initialData?.price || 0],
      taxPercentage: [{ value: initialData?.taxPercentage ?? 18 }],
      taxAmount: [{ value: initialData?.taxAmount || 0, disabled: true }],
      finalPrice: [{ value: initialData?.finalPrice || 0, disabled: true }],
      quotationDiscountAmount: [{ value: initialData?.quotationDiscountAmount || 0, disabled: true }],
      calculations: [initialData?.calculations || []]
    });
  }

  private feetInchValidator(calculationType: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      if(calculationType === 'SQ_FEET'){
        const feet = group.get('feet')?.value || 0;
        const inch = group.get('inch')?.value
        if (feet === 0 && inch === 0) {
          return { bothZero: true };
        }
      }

      if(calculationType === 'MM'){
        const mm = group.get('mm')?.value || 0;
        if (mm === 0){
          return { mmZero: true };
        }
      }
      return null;
    };
  }


  createCalculationGroup(item: any, calculationType: string): FormGroup {
    // console.log('createCalculationGroup item : ', item);
    return this.fb.group({
      mm: [item.mm, calculationType === 'MM' ? Validators.required : null],
      feet: [item.feet],
      nos: [item.nos, Validators.required],
      weight: [item.weight, Validators.required],
      id: [item?.id],
      inch: [item.inch],
      sqFeet: [item.sqFeet, Validators.required],
      runningFeet: [item.runningFeet, Validators.required]
    }, { validators: this.feetInchValidator(calculationType) });
  }
  
  get isCustomerIdSelected(){
    return this.quotationForm?.get('customerId')?.value
  }
  
  private setupCustomerNameSync() {
    this.quotationForm.get('customerId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(customerId => {
        if (customerId) {
          const selectedCustomer = this.customers.find(c => c.id === customerId);
          if (selectedCustomer) {
            this.quotationForm.patchValue({ customerName: selectedCustomer.name });
            this.quotationForm.patchValue({ address: selectedCustomer.address });
            this.quotationForm.patchValue({ contactNumber: selectedCustomer.mobile });
            this.quotationForm.patchValue({ referenceName: selectedCustomer.referenceName });
          }
        }
      });
  }

  addItem(isInitializing = false): void {
    const itemGroup = this.fb.group({
      id: [null],
      productId: ['', Validators.required],
      productType: [''],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
      remarks: [''],
      price: [0],
      taxPercentage: [18],
      taxAmount: [0],
      finalPrice: [0],
      quotationDiscountAmount: [0],
      calculations: [[]],
      quotationItemStatus: null
    });
    
    // Add to form array first so indexing (if needed anywhere else) is correct
    this.itemsFormArray.push(itemGroup);
    
    // Setup logic returning subscription
    const subscription = this.setupItemCalculations(itemGroup);
    this.itemSubscriptions.push(subscription);
    
    this.calculateItemPrice(itemGroup, isInitializing);
    this.calculateTotalAmount();
  }

  removeItem(index: number): void {
    if (this.itemSubscriptions[index]) {
      this.itemSubscriptions[index].unsubscribe();
      this.itemSubscriptions.splice(index, 1);
    }

    // Clean up loading state
    if (this.isLoadingPrices[index]) {
      delete this.isLoadingPrices[index];
    }

    this.itemsFormArray.removeAt(index);

    // Rebuild loading states map with new indices
    const newLoadingPrices: { [key: number]: boolean } = {};
    Object.keys(this.isLoadingPrices).forEach(key => {
      const oldIndex = Number(key);
      if (oldIndex > index) {
        newLoadingPrices[oldIndex - 1] = this.isLoadingPrices[oldIndex];
      } else if (oldIndex < index) {
        newLoadingPrices[oldIndex] = this.isLoadingPrices[oldIndex];
      }
    });
    this.isLoadingPrices = newLoadingPrices;

    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  private setupItemCalculations(group: FormGroup): Subscription {
    const subscription = new Subscription();

    const productIdSub = group.get('productId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        filter(productId => !!productId),
        debounceTime(100),
        distinctUntilChanged()
      )
      .subscribe(productId => {
        const selectedProduct = this.productMap.get(productId);
        if (selectedProduct) {
          this.fetchProductPrice(group, selectedProduct);
        }
      });
    
    if (productIdSub) subscription.add(productIdSub);

    // Consolidated valueChanges subscription
    const valueSub = group.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(100))
      .subscribe(() => {
        this.calculateItemPrice(group);
      });
      
    subscription.add(valueSub);
    
    return subscription;
  }


  calculateItemPrice(group: FormGroup | number, skipChangeDetection = false): void {
    // Support legacy calls with index if any
    let groupControl: FormGroup;
    if (typeof group === 'number') {
      groupControl = this.itemsFormArray.at(group) as FormGroup;
    } else {
      groupControl = group;
    }
    
    if (!groupControl) return;
    
    const values = {
      quantity: Number(Number(groupControl.get('quantity')?.value || 0).toFixed(3)),
      unitPrice: Number(Number(groupControl.get('unitPrice')?.value || 0).toFixed(2)),
      taxPercentage: Number(groupControl.get('taxPercentage')?.value ?? 18)
    };

    const quotationDiscountPercentage = Number(Number(this.quotationForm.get('quotationDiscountPercentage')?.value || 0).toFixed(2));

    // Calculate base price (quantity × unit price)
    const basePrice = Number((values.quantity * values.unitPrice).toFixed(2));
    
    // Calculate gross tax amount (base price × tax percentage)
    const grossTaxAmount = Number(((basePrice * values.taxPercentage) / 100).toFixed(2));
    
    // Calculate quotation discount amount as a percentage of tax amount
    const quotationDiscountAmount = Number(((grossTaxAmount * quotationDiscountPercentage) / 100).toFixed(2));
    
    // Calculate net tax amount
    const netTaxAmount = Number((grossTaxAmount - quotationDiscountAmount).toFixed(2));
    const finalTaxAmount = Math.max(0, netTaxAmount);
    
    // Calculate final price
    const finalPrice = Number((basePrice + finalTaxAmount).toFixed(2));

    groupControl.patchValue({
      price: basePrice,
      quotationDiscountAmount: quotationDiscountAmount,
      taxAmount: finalTaxAmount,
      finalPrice: finalPrice
    }, { emitEvent: false });

    this.calculateTotalAmount();
    
    if (!skipChangeDetection) {
      this.cdr.detectChanges();
    }
  }

  getTotalAmount(): number {
    const itemsTotal = this.itemsFormArray.controls
      .reduce((total, group: any) => total + (Number(group.get('finalPrice').value) || 0), 0);
    const packagingCharges = Number(this.quotationForm.get('packagingAndForwadingCharges')?.value || 0);
    return Math.round(itemsTotal + packagingCharges);
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

  // Memory optimization: build Map for O(1) product lookups
  private buildProductMap(): void {
    this.productMap.clear();
    for (const product of this.products) {
      this.productMap.set(product.id, product);
    }
  }

  private loadTransports(): void {
    this.isLoadingTransports = true;
    this.transportService.getTransports({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response?.success !== false) {
          this.transports = response.data || response.transports || [];
        }
        this.isLoadingTransports = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackbar.error('Failed to load transports');
        this.isLoadingTransports = false;
        this.cdr.markForCheck();
      }
    });
  }

  refreshTransports(): void {
    this.isLoadingTransports = true;
    this.transportService.refreshTransports()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response?.success !== false) {
          this.transports = response.data || response.transports || [];
          this.snackbar.success('Transports refreshed successfully');
        }
        this.isLoadingTransports = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackbar.error('Failed to refresh transports');
        this.isLoadingTransports = false;
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
          this.snackbar.success('Customers refreshed successfully');
        }
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

  private calculateTotalAmount(): void {
    const totals = {
      price: 0,
      tax: 0,
      finalPrice: 0,
      taxAmount: 0,
      taxPercentage: 0,
      quotationDiscountAmount: 0
    };

    this.itemsFormArray.controls.forEach((group: AbstractControl) => {
      const price = Number(Number(group.get('price')?.value || 0).toFixed(2));
      const finalPrice = Number(Number(group.get('finalPrice')?.value || 0).toFixed(2));
      const taxAmount = Number(Number(group.get('taxAmount')?.value || 0).toFixed(2));
      const taxPercentage = Number(group.get('taxPercentage')?.value || 18);
      const quotationDiscountAmount = Number(Number(group.get('quotationDiscountAmount')?.value || 0).toFixed(2));

      totals.price = Number((totals.price + price).toFixed(2));
      totals.tax = Number((totals.tax + taxAmount).toFixed(2));
      totals.finalPrice = Number((totals.finalPrice + finalPrice).toFixed(2));
      totals.taxAmount = Number((totals.taxAmount + taxAmount).toFixed(2));
      totals.taxPercentage = Number(taxPercentage);
      totals.quotationDiscountAmount = Number((totals.quotationDiscountAmount + quotationDiscountAmount).toFixed(2));
    });

    const quotationDiscountPercentage = Number(Number(this.quotationForm.get('quotationDiscountPercentage')?.value || 0).toFixed(2));
    const afterQuotationDiscount = Number((totals.price - totals.quotationDiscountAmount).toFixed(2));
    const packagingCharges = Number(this.quotationForm.get('packagingAndForwadingCharges')?.value || 0);

    this.totals = {
      price: Number((totals.price + packagingCharges).toFixed(2)),
      tax: totals.tax,
      finalPrice: Number((totals.finalPrice + packagingCharges).toFixed(2)),
      taxPercentage: totals.taxPercentage,
      afterQuotationDiscount: afterQuotationDiscount,
      quotationDiscountAmount: totals.quotationDiscountAmount
    };
  }

  resetForm(): void {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 7);

    this.quotationForm.reset({
      quoteDate: formatDate(today, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(validUntil, 'yyyy-MM-dd', 'en'),
      remarks: '',
      termsConditions: '',
      quotationDiscountPercentage: 0
    });

    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }
    this.addItem();
    
    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quotationForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const control = this.itemsFormArray.at(index).get(fieldName);
    if (!control) return false;

    const isInvalid = control.invalid && (control.dirty || control.touched);

    if (isInvalid) {
      const errors = control.errors;
      if (errors) {
        if (errors['required']) return true;
        if (errors['min'] && (fieldName === 'quantity' || fieldName === 'unitPrice')) return true;
      }
    }

    return false;
  }

  getFieldError(fieldName: string): string {
    const control = this.quotationForm.get(fieldName);
    if (control?.errors) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['min']) return `${fieldName} must be greater than ${control.errors['min'].min}`;
      if (control.errors['max']) return `${fieldName} must be less than ${control.errors['max'].max}`;
    }
    return '';
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

  onProductSelect(index: number, event: any): void {
    const selectedProduct = this.productMap.get(event.value);
    if (!selectedProduct) {
      console.warn('No product found with ID:', event.value);
      return;
    }

    const itemGroup = this.itemsFormArray.at(index);
    
    itemGroup.patchValue({
      productId: selectedProduct.id
    }, { emitEvent: true });
  }

  private fetchProductPrice(group: FormGroup, selectedProduct: any): void {
    const index = this.itemsFormArray.controls.indexOf(group);
    
    const taxPercentage = selectedProduct.taxPercentage !== undefined ? 
                        selectedProduct.taxPercentage : 18;
    
    group.patchValue({
      productType: selectedProduct.type,
      taxPercentage: taxPercentage,
      quantity: selectedProduct.quantity || 1
    }, { emitEvent: false });

    const customerId = this.quotationForm.get('customerId')?.value;
    
    if (customerId) {
      // Fetch customer price from API
      this.fetchCustomerPrice(group, selectedProduct.id, customerId, index);
    } else {
      // If no customer selected, use product saleAmount
      group.patchValue({
        unitPrice: (selectedProduct.saleAmount ?? selectedProduct.sale_amount ?? 0)
      }, { emitEvent: true });
      this.calculateItemPrice(group);
    }
  }

  private fetchCustomerPrice(group: FormGroup, productId: number, customerId: number, index: number): void {
    if (index >= 0) {
      this.isLoadingPrices[index] = true;
    }
    
    const cacheKey = `${customerId}-${productId}`;
    
    // Check cache first
    if (this.productPriceCache.has(cacheKey)) {
      const cachedPrice = this.productPriceCache.get(cacheKey)!;
      
      group.patchValue({
        unitPrice: cachedPrice
      }, { emitEvent: true });
      
      if (index >= 0) {
        this.isLoadingPrices[index] = false;
      }
      this.calculateItemPrice(group);
      this.cdr.detectChanges();
      return;
    }
    
    const requestData = {
      customerId: customerId,
      productId: productId
    };

    this.priceService.getCustomerPrice(requestData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          if (index >= 0) {
            this.isLoadingPrices[index] = false;
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const price = response.data.price || 0;
            
            // Cache the price
            this.productPriceCache.set(cacheKey, price);
            
            group.patchValue({
              unitPrice: price
            }, { emitEvent: true });

            this.calculateItemPrice(group);
          } else {
            this.setFallbackPrice(group);
          }
        },
        error: (error) => {
          console.error('Error fetching customer price:', error);
          this.setFallbackPrice(group);
        }
      });
  }

  private setFallbackPrice(group: FormGroup): void {
    const productId = group.get('productId')?.value;
    const selectedProduct = this.productMap.get(productId);
    
    if (selectedProduct) {
      const unitPrice = selectedProduct.saleAmount ?? selectedProduct.sale_amount ?? 0;
      group.patchValue({
        unitPrice: unitPrice
      }, { emitEvent: true });

      this.calculateItemPrice(group);
      this.cdr.detectChanges();
    }
  }

  validateDates(): void {
    const quoteDate = this.quotationForm.get('quoteDate')?.value;
    const validUntil = this.quotationForm.get('validUntil')?.value;

    if (quoteDate && validUntil && new Date(validUntil) < new Date(quoteDate)) {
      this.quotationForm.get('validUntil')?.setErrors({ invalidDate: true });
    }
  }

  private checkForEdit(): void {
    const encryptedId = localStorage.getItem('editQuotationId');

    if (!encryptedId) {
      return;
    }

    try {
      const quotationId = this.encryptionService.decrypt(encryptedId);

      if (!quotationId) {
        localStorage.removeItem('editQuotationId');
        return;
      }

      this.isLoading = true;
      this.quotationService.getQuotationDetail(parseInt(quotationId))
        .pipe(takeUntil(this.destroy$))
        .subscribe({
        next: (response) => {
          if (response) {
            this.quotationId = parseInt(quotationId);
            this.isEdit = true;
            // console.log('edit response >>',response.data)
            this.populateForm(response.data);
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading quotation details:', error);
          this.snackbar.error('Failed to load quotation details');
          this.isLoading = false;
          localStorage.removeItem('editQuotationId');
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Decryption error:', error);
      localStorage.removeItem('editQuotationId');
    }
  }

  async populateForm(data: any) {
    if (!data) return;

    // console.log('Populating form with data:', data);

    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }

    this.quotationForm.patchValue({
      customerName: data.customerName,
      customerId: data.customerId,
      referenceName: data.referenceName || '',
      quoteDate: data.quoteDate,
      validUntil: data.validUntil,
      remarks: data.remarks || '',
      termsConditions: data.termsConditions || '',
      address: data.address,
      contactNumber: data.contactNumber,
      quotationDiscountPercentage: data.quotationDiscountPercentage || data.quotationDiscount || 0,
      transportMasterId: data.transportMasterId || null,
      caseNumber: data.caseNumber || '',
      packagingAndForwadingCharges: data.packagingAndForwadingCharges ?? 0
    });

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        const product = this.products.find(p => p.id === item.productId);
        const taxPercentage = product?.taxPercentage !== undefined 
          ? product.taxPercentage 
          : (item.taxPercentage ?? 18);

        // console.log(`Loaded item ${item.productId} with tax percentage: ${taxPercentage}%`);
        
        const itemGroup = this.fb.group({
          id: [item.id || null],
          productId: [item.productId || '', Validators.required],
          productType: [item.productType || ''],
          quantity: [item.quantity || 1, [Validators.required, Validators.min(0.001)]],
          unitPrice: [item.unitPrice || 0, [Validators.required, Validators.min(0.01)]],
          remarks: [item.remarks || ''],
          price: [item.price || 0],
          taxPercentage: [taxPercentage],
          taxAmount: [item.taxAmount || 0],
          finalPrice: [item.finalPrice || 0],
          quotationDiscountAmount: [item.quotationDiscountAmount || 0],
          calculations: [item.calculations || []],
          quotationItemStatus: [item.quotationItemStatus || null]
        });
        
        this.itemsFormArray.push(itemGroup);
        const subscription = this.setupItemCalculations(itemGroup);
        this.itemSubscriptions.push(subscription);
      });
    }
    
    this.itemsFormArray.controls.forEach((_, index) => {
      this.calculateItemPrice(index);
    });
    
    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.quotationForm.valid) {
      this.isLoading = true;
      const formData = this.prepareFormData();

      const request$ = this.isEdit
        ? this.quotationService.updateQuotation(this.quotationId!, formData)
        : this.quotationService.createQuotation(formData);

      request$
        .pipe(takeUntil(this.destroy$))
        .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.snackbar.success(`Quotation ${this.isEdit ? 'updated' : 'created'} successfully`);
            this.quotationForm.reset();
            this.router.navigate(['/quotation']);
          }
          this.isLoading = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || `Failed to ${this.isEdit ? 'update' : 'create'} quotation`);
          this.isLoading = false;
        }
      });
    }
  }

  private prepareFormData() {
    const formValue = this.quotationForm.value;
    
    const quotationDiscountPercentageControl = this.quotationForm.get('quotationDiscountPercentage');
    const quotationDiscountPercentage = Number(quotationDiscountPercentageControl?.value || 0);
    
    // console.log('Explicitly getting quotationDiscountPercentage:', quotationDiscountPercentage);
    
    const items = this.itemsFormArray.controls.map((control) => {
      return {
        id: control.get('id')?.value,
        productId: control.get('productId')?.value,
        productType: control.get('productType')?.value,
        quantity: control.get('quantity')?.value,
        unitPrice: control.get('unitPrice')?.value,
        remarks: control.get('remarks')?.value,
        price: control.get('price')?.value,
        taxPercentage: control.get('taxPercentage')?.value,
        taxAmount: control.get('taxAmount')?.value,
        finalPrice: control.get('finalPrice')?.value,
        quotationDiscountAmount: control.get('quotationDiscountAmount')?.value,
        calculations: control.get('calculations')?.value || [],
        quotationItemStatus: control.get('quotationItemStatus')?.value
      };
    });

    const finalFormData = {
      customerId: formValue.customerId,
      customerName: formValue.customerName,
      referenceName: formValue.referenceName,
      contactNumber: formValue.contactNumber,
      quoteDate: formatDate(formValue.quoteDate, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(formValue.validUntil, 'yyyy-MM-dd', 'en'),
      remarks: formValue.remarks,
      termsConditions: formValue.termsConditions,
      address: formValue.address,
      quotationDiscountPercentage: quotationDiscountPercentage,
      transportMasterId: formValue.transportMasterId,
      caseNumber: formValue.caseNumber,
      packagingAndForwadingCharges: Number(formValue.packagingAndForwadingCharges || 0),
      items: items
    };
    
    // console.log('Final form data to be submitted:', finalFormData);
    
    return finalFormData;
  }



  private setupCustomerChangeListener(): void {
    this.quotationForm.get('customerId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.productPriceCache.clear();
      });
  }

  onQuotationDiscountPercentageChange(event: any): void {
    // console.log('Quotation discount percentage changed to:', event.target.value);
    
    const newValue = Number(event.target.value || 0);
    
    this.quotationForm.get('quotationDiscountPercentage')?.setValue(newValue, { emitEvent: false });
    
    this.itemsFormArray.controls.forEach((group: AbstractControl) => {
      this.calculateItemPrice(group as FormGroup);
    });
    
    this.calculateTotalAmount();
    
    this.cdr.detectChanges();
  }

  // Map item status code to human-readable label using QuotationItemStatus enum
  getQuotationItemStatusLabel(code: string | null | undefined): string {
    if (!code) return '';
    const map: Record<string, string> = {
      O: QuotationItemStatus.O,
      I: QuotationItemStatus.I,
      C: QuotationItemStatus.C,
      B: QuotationItemStatus.B,
    } as unknown as Record<string, string>;
    return map[code] || String(code);
  }

  // Touch event handling for mobile devices
  private touchStartTime: number = 0;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isTouchScrolling: boolean = false;

  handleTouchStart(event: TouchEvent): void {
    this.touchStartTime = Date.now();
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.isTouchScrolling = false;
  }

  handleTouchMove(event: TouchEvent): void {
    const touchMoveX = event.touches[0].clientX;
    const touchMoveY = event.touches[0].clientY;
    const deltaX = Math.abs(touchMoveX - this.touchStartX);
    const deltaY = Math.abs(touchMoveY - this.touchStartY);
    
    // If user has moved more than 10px, consider it scrolling/dragging
    if (deltaX > 10 || deltaY > 10) {
      this.isTouchScrolling = true;
    }
  }

  handleTouchEnd(event: TouchEvent): void {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - this.touchStartTime;
    
    // Prevent accidental form submissions from quick taps
    if (touchDuration < 200 && !this.isTouchScrolling) {
      // This was a quick tap, not a scroll
      event.preventDefault();
    }
  }

}

