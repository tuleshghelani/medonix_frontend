import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, Subscription, debounceTime, filter, distinctUntilChanged } from 'rxjs';
import { formatDate } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { QuotationService } from '../../../services/quotation.service';
import { SearchableSelectComponent } from "../../../shared/components/searchable-select/searchable-select.component";
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  standalone: true,
  selector: 'app-dealer-add-quotation',
  templateUrl: './dealer-add-quotation.component.html',
  styleUrls: ['./dealer-add-quotation.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SearchableSelectComponent,
    LoaderComponent
  ]
})
export class DealerAddQuotationComponent implements OnInit, OnDestroy {
  quotationForm!: FormGroup;
  products: any[] = [];
  loading = false;
  isLoadingProducts = false;
  private destroy$ = new Subject<void>();
  isLoading = false;

  totals: { price: number; tax: number; finalPrice: number; taxPercentage: number } = {
    price: 0,
    tax: 0,
    finalPrice: 0,
    taxPercentage: 0
  };

  private itemSubscriptions: Subscription[] = [];

  get itemsFormArray() {
    return this.quotationForm.get('items') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private quotationService: QuotationService,
    private productService: ProductService,
    private snackbar: SnackbarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
    this.setupItemSubscriptions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.itemSubscriptions.forEach(sub => sub?.unsubscribe());
    this.itemSubscriptions = [];
    this.products = [];
  }

  private initForm() {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 7);

    this.quotationForm = this.fb.group({
      quoteDate: [formatDate(today, 'yyyy-MM-dd', 'en')],
      validUntil: [formatDate(validUntil, 'yyyy-MM-dd', 'en')],
      remarks: [''],
      items: this.fb.array([])
    });

    this.addItem(true);
  }

  addItem(isInitializing = false): void {
    const itemGroup = this.fb.group({
      id: [null],
      productId: ['', Validators.required],
      productType: [''],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [0],
      remarks: [''],
      price: [0],
      taxPercentage: [5],
      taxAmount: [0],
      finalPrice: [0],
      calculations: [[]]
    });

    this.itemsFormArray.push(itemGroup);
    const newIndex = this.itemsFormArray.length - 1;

    this.setupItemCalculations(itemGroup, newIndex);
    this.subscribeToItemChanges(this.itemsFormArray.at(newIndex), newIndex);

    this.calculateItemPrice(newIndex, isInitializing);
    this.calculateTotalAmount();
  }

  removeItem(index: number): void {
    if (this.itemSubscriptions[index]) {
      this.itemSubscriptions[index].unsubscribe();
      this.itemSubscriptions.splice(index, 1);
    }

    this.itemsFormArray.removeAt(index);

    this.itemsFormArray.controls.forEach((control, newIndex) => {
      if (this.itemSubscriptions[newIndex]) {
        this.itemSubscriptions[newIndex].unsubscribe();
      }
      this.subscribeToItemChanges(control, newIndex);
    });

    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  private setupItemCalculations(group: FormGroup, index: number) {
    group.get('productId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        filter(productId => !!productId),
        debounceTime(100),
        distinctUntilChanged()
      )
      .subscribe(productId => {
        const selectedProduct = this.products.find(p => p.id === productId);
        if (selectedProduct) {
          this.setProductPrice(index, selectedProduct);
        }
      });

    group.get('quantity')?.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(50))
      .subscribe(() => this.calculateItemPrice(index));

    group.get('taxPercentage')?.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(50))
      .subscribe(() => this.calculateItemPrice(index));
  }

  private setProductPrice(index: number, selectedProduct: any): void {
    const itemGroup = this.itemsFormArray.at(index);

    const taxPercentage = selectedProduct.taxPercentage !== undefined ?
      selectedProduct.taxPercentage : 5;

    const unitPrice = selectedProduct.saleAmount ?? selectedProduct.sale_amount ?? 0;

    itemGroup.patchValue({
      productType: selectedProduct.type,
      taxPercentage: taxPercentage,
      quantity: selectedProduct.quantity || 1,
      unitPrice: unitPrice
    }, { emitEvent: false });

    this.calculateItemPrice(index);
  }

  calculateItemPrice(index: number, skipChangeDetection = false): void {
    const group = this.itemsFormArray.at(index) as FormGroup;

    const values = {
      quantity: Number(Number(group.get('quantity')?.value || 0).toFixed(3)),
      unitPrice: Number(Number(group.get('unitPrice')?.value || 0).toFixed(2)),
      taxPercentage: Number(group.get('taxPercentage')?.value ?? 5)
    };

    const basePrice = Number((values.quantity * values.unitPrice).toFixed(2));
    const taxAmount = Number(((basePrice * values.taxPercentage) / 100).toFixed(2));
    const finalPrice = Number((basePrice + taxAmount).toFixed(2));

    group.patchValue({
      price: basePrice,
      taxAmount: taxAmount,
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
    return Math.round(itemsTotal);
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
        error: () => {
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
        error: () => {
          this.snackbar.error('Failed to refresh products');
          this.isLoadingProducts = false;
        }
      });
  }

  private calculateTotalAmount(): void {
    const totals = {
      price: 0,
      tax: 0,
      finalPrice: 0,
      taxPercentage: 0
    };

    this.itemsFormArray.controls.forEach((group: AbstractControl) => {
      const price = Number(Number(group.get('price')?.value || 0).toFixed(2));
      const finalPrice = Number(Number(group.get('finalPrice')?.value || 0).toFixed(2));
      const taxAmount = Number(Number(group.get('taxAmount')?.value || 0).toFixed(2));
      const taxPercentage = Number(group.get('taxPercentage')?.value || 5);

      totals.price = Number((totals.price + price).toFixed(2));
      totals.tax = Number((totals.tax + taxAmount).toFixed(2));
      totals.finalPrice = Number((totals.finalPrice + finalPrice).toFixed(2));
      totals.taxPercentage = Number(taxPercentage);
    });

    this.totals = totals;
  }

  resetForm(): void {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 7);

    this.quotationForm.reset({
      quoteDate: formatDate(today, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(validUntil, 'yyyy-MM-dd', 'en'),
      remarks: ''
    });

    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }
    this.addItem();

    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const control = this.itemsFormArray.at(index).get(fieldName);
    if (!control) return false;

    const isInvalid = control.invalid && (control.dirty || control.touched);

    if (isInvalid) {
      const errors = control.errors;
      if (errors) {
        if (errors['required']) return true;
        if (errors['min'] && (fieldName === 'quantity')) return true;
      }
    }

    return false;
  }

  onProductSelect(index: number, event: any): void {
    const selectedProduct = this.products.find(p => p.id === event.value);
    if (!selectedProduct) {
      return;
    }

    const itemGroup = this.itemsFormArray.at(index);

    const oldSub = this.itemSubscriptions[index];
    if (oldSub) {
      oldSub.unsubscribe();
      this.itemSubscriptions[index] = new Subscription();
    }

    itemGroup.patchValue({
      productId: selectedProduct.id
    }, { emitEvent: true });

    if (!this.itemSubscriptions[index]) {
      this.subscribeToItemChanges(itemGroup, index);
    }
  }

  onSubmit(): void {
    if (this.quotationForm.valid) {
      this.isLoading = true;
      const formData = this.prepareFormData();

      this.quotationService.createQuotation(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.snackbar.success('Dealer order created successfully');
              this.quotationForm.reset();
              this.router.navigate(['/quotation']);
            }
            this.isLoading = false;
          },
          error: (error: any) => {
            this.snackbar.error(error?.error?.message || 'Failed to create dealer order');
            this.isLoading = false;
          }
        });
    }
  }

  private prepareFormData() {
    const formValue = this.quotationForm.value;

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
        quotationDiscountAmount: 0,
        calculations: control.get('calculations')?.value || []
      };
    });

    return {
      quoteDate: formatDate(formValue.quoteDate, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(formValue.validUntil, 'yyyy-MM-dd', 'en'),
      remarks: formValue.remarks,
      termsConditions: '',
      quotationDiscountPercentage: 0,
      packagingAndForwadingCharges: 0,
      items: items
    };
  }

  private setupItemSubscriptions(): void {
    this.itemsFormArray.controls.forEach((control, index) => {
      this.subscribeToItemChanges(control, index);
    });
  }

  private subscribeToItemChanges(control: AbstractControl, index: number): void {
    if (this.itemSubscriptions[index]) {
      this.itemSubscriptions[index].unsubscribe();
    }

    const subscription = control.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(100),
    ).subscribe(() => {
      this.calculateItemPrice(index);
    });

    this.itemSubscriptions[index] = subscription;
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

    if (deltaX > 10 || deltaY > 10) {
      this.isTouchScrolling = true;
    }
  }

  handleTouchEnd(event: TouchEvent): void {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - this.touchStartTime;

    if (touchDuration < 200 && !this.isTouchScrolling) {
      event.preventDefault();
    }
  }
}
