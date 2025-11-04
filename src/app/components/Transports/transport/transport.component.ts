import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { Transport, TransportSummary } from '../../../models/transport.model';
import { TransportService } from '../../../services/transport.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PriceService } from '../../../services/price.service';

@Component({
  selector: 'app-transport',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    LoaderComponent,
    RouterLink,
    ConfirmModalComponent
  ],
  templateUrl: './transport.component.html',
  styleUrls: ['./transport.component.scss']
})
export class TransportComponent implements OnInit {
  transportForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  showDeleteBagModal = false;
  showDeleteItemModal = false;
  deleteBagIndex: number | null = null;
  deleteItemIndices: { bagIndex: number; itemIndex: number } | null = null;
  transportId: number | null = null;
  isEditMode = false;
  transportSummary: TransportSummary | null = null;
  isPrinting = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private customerService: CustomerService,
    private transportService: TransportService,
    private snackbar: SnackbarService,
    private priceService: PriceService
  ) {
    this.initializeForm();
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.transportId = +params['id'];
        this.isEditMode = true;
        this.loadTransportDetail();
      }
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    
    // Setup customer change handler
    // this.transportForm.get('customerId')?.valueChanges.subscribe(() => {
    //   const bags = this.transportForm.get('bags') as FormArray;
    //   bags.controls.forEach(bag => {
    //     const items = bag.get('items') as FormArray;
    //     items.controls.forEach(item => {
    //       if (item.get('productId')?.value) {
    //         this.setupPriceFetching(item);
    //       }
    //     });
    //   });
    // });
  }

  private initializeForm(): void {
    this.transportForm = this.fb.group({
      customerId: ['', [Validators.required]],
      bags: this.fb.array([])
    });
  }

  get bags(): FormArray {
    return this.transportForm.get('bags') as FormArray;
  }

  addBag(): void {
    const bagGroup = this.fb.group({
      weight: ['', [Validators.required, Validators.min(0.01)]],
      items: this.fb.array([])
    });
    this.bags.push(bagGroup);
    this.addItem(this.bags.length - 1); // Add first item automatically
  }

  removeBag(bagIndex: number): void {
    this.deleteBagIndex = bagIndex;
    this.showDeleteBagModal = true;
  }

  getBagItems(bagIndex: number): FormArray {
    return this.bags.at(bagIndex).get('items') as FormArray;
  }

  addItem(bagIndex: number): void {
    const items = this.getBagItems(bagIndex);
    const newItem = this.fb.group({
      productId: ['', [Validators.required]],
      quantity: ['', [Validators.required, Validators.min(1)]],
      remarks: [''],
      // Purchase fields
      purchaseUnitPrice: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscount: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscountPrice: [0, [Validators.required, Validators.min(0)]],
      // Sale fields
      saleUnitPrice: [0, [Validators.required, Validators.min(0)]],
      saleDiscount: [0, [Validators.required, Validators.min(0)]],
      saleDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      saleDiscountPrice: [0, [Validators.required, Validators.min(0)]]
    });

    // Setup price fetching when product changes
    newItem.get('productId')?.valueChanges.subscribe(() => {
      this.setupPriceFetching(newItem);
    });

    items.push(newItem);
    this.setupDiscountCalculations(bagIndex, items.length - 1);
  }

  private setupDiscountCalculations(bagIndex: number, itemIndex: number): void {
    const itemGroup = this.getBagItems(bagIndex).at(itemIndex);
    
    // Setup purchase discount calculation
    ['quantity', 'purchaseUnitPrice', 'purchaseDiscount', 'purchaseDiscountAmount'].forEach(field => {
      itemGroup.get(field)?.valueChanges.subscribe((value) => {
        // Only calculate if the field is not null/undefined
        if (value !== null && value !== undefined) {
          this.calculateDiscount(bagIndex, itemIndex, 'purchase');
        }
      });
    });

    // Setup sale discount calculation
    ['quantity', 'saleUnitPrice', 'saleDiscount', 'saleDiscountAmount'].forEach(field => {
      itemGroup.get(field)?.valueChanges.subscribe((value) => {
        // Only calculate if the field is not null/undefined
        if (value !== null && value !== undefined) {
          this.calculateDiscount(bagIndex, itemIndex, 'sale');
        }
      });
    });
  }

  private calculateDiscount(bagIndex: number, itemIndex: number, type: 'purchase' | 'sale'): void {
    const itemGroup = this.getBagItems(bagIndex).at(itemIndex);
    const prefix = type === 'purchase' ? 'purchase' : 'sale';

    const values = {
      quantity: Number(itemGroup.get('quantity')?.value) || 0,
      unitPrice: Number(itemGroup.get(`${prefix}UnitPrice`)?.value) || 0,
      discountPercentage: Number(itemGroup.get(`${prefix}Discount`)?.value),
      discountAmount: Number(itemGroup.get(`${prefix}DiscountAmount`)?.value),
      finalPrice: 0
    };

    const totalPrice = values.quantity * values.unitPrice;

    // Reset logic
    if (values.discountPercentage === 0 && values.discountAmount === 0) {
      values.finalPrice = totalPrice;
    }
    // Handle discount amount changes
    else if (itemGroup.get(`${prefix}DiscountAmount`)?.dirty) {
      values.finalPrice = totalPrice - values.discountAmount;
      values.discountPercentage = totalPrice > 0 ? (values.discountAmount / totalPrice) * 100 : 0;
    }
    // Handle discount percentage changes
    else if (itemGroup.get(`${prefix}Discount`)?.dirty) {
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    }
    // Default case
    else {
      values.finalPrice = totalPrice;
    }

    // Ensure non-negative values
    values.finalPrice = Math.max(0, values.finalPrice);
    values.discountAmount = Math.max(0, values.discountAmount);
    values.discountPercentage = Math.max(0, values.discountPercentage);

    itemGroup.patchValue({
      [`${prefix}DiscountAmount`]: values.discountAmount,
      [`${prefix}Discount`]: values.discountPercentage,
      [`${prefix}DiscountPrice`]: values.finalPrice
    }, { emitEvent: false });
  }

  removeItem(bagIndex: number, itemIndex: number): void {
    this.deleteItemIndices = { bagIndex, itemIndex };
    this.showDeleteItemModal = true;
  }

  loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to load customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers().subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
          this.snackbar.success('Customers refreshed successfully');
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
          // If in edit mode, populate the form after products are loaded
          if (this.isEditMode && this.transportId) {
            // this.loadTransportDetail();
          }
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
    this.productService.refreshProducts().subscribe({
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

  isFieldInvalid(field: any): boolean {
    return field?.invalid && (field?.dirty || field?.touched);
  }

  getFieldError(field: any): string {
    if (!field) return '';
    
    if (field.hasError('required')) {
      return 'This field is required';
    }
    
    if (field.hasError('min')) {
      const min = field.errors?.['min'].min;
      return `Value must be greater than ${min}`;
    }
    
    return '';
  }

  getCustomErrorMessage(field: any, fieldName: string): string {
    if (!field?.errors) return '';
    
    if (field.hasError('required')) {
      return `Please enter ${fieldName}`;
    }
    
    if (field.hasError('min')) {
      const min = field.errors?.['min'].min;
      if (fieldName === 'weight') {
        return `Weight must be greater than ${min}kg`;
      }
      return `${fieldName} must be greater than ${min}`;
    }
    
    return '';
  }

  validateForm(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate customer selection
    if (!this.transportForm.get('customerId')?.value) {
      errors.push('Please select a customer');
    }

    // Validate bags
    if (this.bags.length === 0) {
      errors.push('Please add at least one bag');
    } else {
      this.bags.controls.forEach((bag, bagIndex) => {
        // Validate bag weight
        if (!bag.get('weight')?.value) {
          errors.push(`Please enter weight for Bag #${bagIndex + 1}`);
        } else if (bag.get('weight')?.errors?.['min']) {
          errors.push(`Weight must be greater than 0kg for Bag #${bagIndex + 1}`);
        }

        // Validate bag items
        const items = this.getBagItems(bagIndex);
        if (items.length === 0) {
          errors.push(`Please add at least one item in Bag #${bagIndex + 1}`);
        } else {
          items.controls.forEach((item, itemIndex) => {
            if (!item.get('productId')?.value) {
              errors.push(`Please select product for item ${itemIndex + 1} in Bag #${bagIndex + 1}`);
            }
            if (!item.get('quantity')?.value) {
              errors.push(`Please enter quantity for item ${itemIndex + 1} in Bag #${bagIndex + 1}`);
            } else if (item.get('quantity')?.errors?.['min']) {
              errors.push(`Quantity must be greater than 0 for item ${itemIndex + 1} in Bag #${bagIndex + 1}`);
            }
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  onSubmit(): void {
    if (this.transportForm.invalid) {
      this.markFormGroupTouched(this.transportForm);
      return;
    }

    const formValue = this.transportForm.value;
    // Transform the data to match the required format
    const payload = {
      id: this.isEditMode ? this.transportId : undefined,
      customerId: formValue.customerId,
      bags: formValue.bags.map((bag: any) => ({
        weight: bag.weight,
        items: bag.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          remarks: item.remarks || '',
          purchaseUnitPrice: item.purchaseUnitPrice,
          purchaseDiscount: item.purchaseDiscount,
          purchaseDiscountAmount: item.purchaseDiscountAmount,
          purchaseDiscountPrice: item.purchaseDiscountPrice,
          saleUnitPrice: item.saleUnitPrice,
          saleDiscount: item.saleDiscount,
          saleDiscountAmount: item.saleDiscountAmount,
          saleDiscountPrice: item.saleDiscountPrice
        }))
      }))
    };

    // Choose appropriate API call based on mode
    const apiCall = this.isEditMode ? 
      this.transportService.updateTransport(payload) :
      this.transportService.createTransport(payload);

    apiCall.subscribe({
      next: (response) => {
        this.snackbar.success(`Transport ${this.isEditMode ? 'updated' : 'created'} successfully`);
        this.router.navigate(['/transport']);
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} transport`);
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
      }
    });
  }

  resetForm(): void {
    this.transportForm.reset();
    while (this.bags.length) {
      this.bags.removeAt(0);
    }
  }

  onDeleteBag(bagIndex: number): void {
    this.deleteBagIndex = bagIndex;
    this.showDeleteBagModal = true;
  }

  onDeleteItem(bagIndex: number, itemIndex: number): void {
    this.deleteItemIndices = { bagIndex, itemIndex };
    this.showDeleteItemModal = true;
  }

  confirmDeleteBag(): void {
    if (this.deleteBagIndex !== null) {
      this.bags.removeAt(this.deleteBagIndex);
      this.showDeleteBagModal = false;
      this.deleteBagIndex = null;
    }
  }

  confirmDeleteItem(): void {
    if (this.deleteItemIndices) {
      const { bagIndex, itemIndex } = this.deleteItemIndices;
      const items = this.getBagItems(bagIndex);
      if (items.length > 1) {
        items.removeAt(itemIndex);
      }
      this.showDeleteItemModal = false;
      this.deleteItemIndices = null;
    }
  }

  cancelDelete(): void {
    this.showDeleteBagModal = false;
    this.showDeleteItemModal = false;
    this.deleteBagIndex = null;
    this.deleteItemIndices = null;
  }
  private loadTransportDetail(): void {
    if (!this.transportId) return;
    
    this.loading = true;
    this.transportService.getTransportDetail(this.transportId).subscribe({
      next: (response) => {
        if (response.success) {
          this.populateForm(response.data);
        }
        this.loading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load transport details');
        this.loading = false;
      }
    });
  }

  private populateForm(data: any): void {
    if (!this.products.length) {
      this.snackbar.error('Products not loaded yet');
      return;
    }

    // Clear existing bags
    while (this.bags.length) {
      this.bags.removeAt(0);
    }

    // Set customer
    this.transportForm.patchValue({
      customerId: data.customerId
    });

    // Add bags and their items
    data.bags.forEach((bag: any) => {
      // First create and add the bag
      const bagGroup = this.fb.group({
        id: [bag.id],
        weight: [bag.weight, [Validators.required, Validators.min(0.01)]],
        items: this.fb.array([])
      });
      this.bags.push(bagGroup); // Add bag first
      const currentBagIndex = this.bags.length - 1;

      // Then add items to the bag
      bag.items.forEach((item: any) => {
        const itemGroup = this.fb.group({
          id: [item.id],
          productId: [item.productId, [Validators.required]],
          quantity: [item.quantity, [Validators.required, Validators.min(1)]],
          remarks: [item.remarks || ''],
          // Purchase fields
          purchaseUnitPrice: [item.purchase.unitPrice, [Validators.required, Validators.min(0)]],
          purchaseDiscount: [item.purchase.discount, [Validators.required, Validators.min(0)]],
          purchaseDiscountAmount: [item.purchase.discountAmount, [Validators.required, Validators.min(0)]],
          purchaseDiscountPrice: [item.purchase.discountPrice, [Validators.required, Validators.min(0)]],
          // Sale fields
          saleUnitPrice: [item.sale.unitPrice, [Validators.required, Validators.min(0)]],
          saleDiscount: [item.sale.discount, [Validators.required, Validators.min(0)]],
          saleDiscountAmount: [item.sale.discountAmount, [Validators.required, Validators.min(0)]],
          saleDiscountPrice: [item.sale.discountPrice, [Validators.required, Validators.min(0)]]
        });

        const itemsArray = this.getBagItems(currentBagIndex);
        itemsArray.push(itemGroup);
        
        // Setup calculations after item is added
        this.setupDiscountCalculations(currentBagIndex, itemsArray.length - 1);
      });
    });

    // Add summary data
    this.transportSummary = {
      totalBags: data.totalBags,
      totalWeight: data.totalWeight,
      totalSaleAmount: data.summary.totalSaleAmount,
      totalProfit: data.summary.totalProfit,
      totalPurchaseAmount: data.summary.totalPurchaseAmount,
      createdAt: new Date(data.createdAt)
    };

    // Trigger change detection
    this.transportForm.updateValueAndValidity();
  }

  calculateTotalWeight(): number {
    return this.bags.controls.reduce((total, bag) => {
      return total + (bag.get('weight')?.value || 0);
    }, 0);
  }

  private getErrorMessage(control: AbstractControl, fieldName: string): string {
    if (control.hasError('required')) {
      return `${fieldName} is required`;
    }
    if (control.hasError('min')) {
      return `${fieldName} must be greater than ${control.errors?.['min'].min}`;
    }
    return '';
  }

  private setupPriceFetching(item: AbstractControl): void {
    const productControl = item.get('productId');
    const customerId = this.transportForm.get('customerId')?.value;

    if (productControl && customerId) {
      this.priceService.getLatestPrices({
        productId: productControl.value,
        customerId: customerId
      }).subscribe({
        next: (response) => {
          if (response.success) {
            item.patchValue({
              purchaseUnitPrice: response.data.lastPurchasePrice || 0,
              saleUnitPrice: response.data.lastSalePrice || 0
            }, { emitEvent: true }); // Trigger calculations
          }
        },
        error: () => {
          this.snackbar.error('Failed to fetch latest prices');
        }
      });
    }
  }

  onPrint(): void {
    if (!this.transportId || this.isPrinting || this.loading) return;
    
    this.isPrinting = true;
    this.transportService.generatePdf(this.transportId).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isPrinting = false;
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
        this.isPrinting = false;
      }
    });
  }
}
