import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, forwardRef, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: any[] = [];
  @Input() labelKey: string = 'name';
  @Input() valueKey: string = 'id';
  @Input() placeholder: string = 'Select an option';
  @Input() defaultOption: { label: string; value: any } | null = null;
  @Input() searchPlaceholder: string = 'Search...';
  @Input() multiple = false;
  // New inputs
  @Input() allowClear = true;
  @Input() focusWidthPx?: number; // Optional width applied on focus (in pixels)
  @Input() maxHeight: string = '200px'; // Maximum height for dropdown
  @Input() virtualScroll = false; // Enable virtual scrolling for large datasets
  @Input() searchDebounceMs = 300; // Debounce search input

  @Output() selectionChange = new EventEmitter<any>();

  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdown', { static: false }) dropdown!: ElementRef<HTMLDivElement>;

  searchText: string = '';
  isOpen: boolean = false;
  selectedValue: any = '';
  selectedValues: any[] = [];
  filteredOptions: any[] = [];
  highlightedIndex: number = -1;
  interactingWithDropdown = false;

  onChange: any = () => {};
  onTouch: any = () => {};

  private searchDebounceTimer: any;

  constructor(
    private elementRef: ElementRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.options = this.options.map(item => {
      return {
          ...item,
          name: this.formatText(item.name)
      };
    });
    this.filteredOptions = this.options;
  }

  ngOnDestroy(): void {
    // Clean up references to prevent memory leaks
    this.options = [];
    this.filteredOptions = [];
    this.selectedValues = [];
    this.onChange = null;
    this.onTouch = null;
    
    // Clear debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
  
  hasSelection(): boolean {
    return this.multiple ? this.selectedValues.length > 0 : !!this.selectedValue;
  }
  
  onDropdownPointerDown(event?: Event) {
    // Prevent input blur from closing dropdown prematurely on mobile
    if (event) {
      event.stopPropagation();
    }
    this.interactingWithDropdown = true;
  }

  
  scrollOptions(direction: 'up' | 'down', event?: MouseEvent | TouchEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const container = document.querySelector('.options-container');
    if (!container) return;

    const scrollAmount = 160; // Height of 4 options (40px each)
    const currentScroll = container.scrollTop;
    
    if (direction === 'up') {
      container.scrollTo({
        top: currentScroll - scrollAmount,
        behavior: 'smooth'
      });
      this.highlightedIndex = Math.max(this.highlightedIndex - 4, 0);
    } else {
      container.scrollTo({
        top: currentScroll + scrollAmount,
        behavior: 'smooth'
      });
      this.highlightedIndex = Math.min(
        this.highlightedIndex + 4, 
        this.filteredOptions.length - 1
      );
    }
  }

  writeValue(value: any): void {
    if (this.multiple) {
      this.selectedValues = value || [];
    } else {
      this.selectedValue = value;
      if (value) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === value);
        if (selectedOption) {
          this.searchText = selectedOption[this.labelKey];
        }
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  toggleDropdown(event?: Event) {
    event?.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchText = '';
      this.filterOptions();
      
      // Focus the search input when dropdown opens
      setTimeout(() => {
        if (this.searchInput) {
          this.searchInput.nativeElement.focus();
        }
      }, 0);
    }
  }

  onFocus() {
    this.isOpen = true;
    this.filterOptions();
    this.highlightedIndex = -1;
    
    // Apply custom width on focus if specified
    if (this.focusWidthPx) {
      // Ensure we're setting the width on the correct element
      const element = this.elementRef.nativeElement as HTMLElement;
      
      // Instead of absolute positioning, we'll expand the parent container
      // Find the parent container and expand it
      const parentContainer = element.closest('.select-group') as HTMLElement;
      if (parentContainer) {
        // Store original width to restore later
        const originalMinWidth = parentContainer.style.minWidth;
        const originalWidth = parentContainer.style.width;
        
        // Set data attributes to store original values
        parentContainer.setAttribute('data-original-min-width', originalMinWidth || '');
        parentContainer.setAttribute('data-original-width', originalWidth || '');
        
        // Expand the parent container
        parentContainer.style.minWidth = `${this.focusWidthPx}px`;
        parentContainer.style.width = `${this.focusWidthPx}px`;
        parentContainer.style.transition = 'all 0.3s ease';
        
        // Add a class for additional CSS styling
        parentContainer.classList.add('expanded');
      }
      
      // Also apply to the component itself
      element.style.width = `${this.focusWidthPx}px`;
      element.style.minWidth = `${this.focusWidthPx}px`;
      element.style.maxWidth = `${this.focusWidthPx}px`;
      
      // Add a class for additional CSS styling
      element.classList.add('custom-width');
      
      // Also apply to the inner searchable-select div
      const innerDiv = element.querySelector('.searchable-select') as HTMLElement;
      if (innerDiv) {
        innerDiv.style.width = `${this.focusWidthPx}px`;
        innerDiv.style.minWidth = `${this.focusWidthPx}px`;
        innerDiv.style.maxWidth = `${this.focusWidthPx}px`;
      }
    }
  }

  onBlur() {
    setTimeout(() => {
      if (this.interactingWithDropdown) {
        return;
      }
      if (!this.multiple) {
        this.isOpen = false;
        this.highlightedIndex = -1;
        const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        this.searchText = selected ? selected[this.labelKey] : '';
        
        // Reset width on blur
        if (this.focusWidthPx) {
          const element = this.elementRef.nativeElement as HTMLElement;
          
          // Reset the parent container
          const parentContainer = element.closest('.select-group') as HTMLElement;
          if (parentContainer) {
            // Restore original width values
            const originalMinWidth = parentContainer.getAttribute('data-original-min-width') || '';
            const originalWidth = parentContainer.getAttribute('data-original-width') || '';
            
            parentContainer.style.minWidth = originalMinWidth;
            parentContainer.style.width = originalWidth;
            
            // Remove the custom class
            parentContainer.classList.remove('expanded');
          }
          
          // Reset styles on the component itself
          element.style.width = '';
          element.style.minWidth = '';
          element.style.maxWidth = '';
          
          // Remove the custom class
          element.classList.remove('custom-width');
          
          // Also reset the inner div
          const innerDiv = element.querySelector('.searchable-select') as HTMLElement;
          if (innerDiv) {
            innerDiv.style.width = '';
            innerDiv.style.minWidth = '';
            innerDiv.style.maxWidth = '';
          }
        }
      }
    }, 200);
  }

  onSearch(event: any) {
    const value = event.target.innerText;
    
    // If multiple selection and has selected values, don't update search text
    if (this.multiple && this.selectedValues.length > 0 && !this.isOpen) {
      this.searchText = this.getDisplayText();
      return;
    }
    
    this.searchText = value;
    
    // Implement search debouncing
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    this.searchDebounceTimer = setTimeout(() => {
      this.filterOptions();
      this.isOpen = true;
    }, this.searchDebounceMs);
  }

  filterOptions() {
    this.filteredOptions = this.options.filter(option =>
      option[this.labelKey].toLowerCase().includes(this.searchText.toLowerCase())
    );
    
    if(!this.filteredOptions.length){
      this.filteredOptions = this.options;
    };
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
  }

  selectOption(option: any, event?: Event) {
    event?.stopPropagation();
    if (this.multiple) {
      const value = option[this.valueKey];
      const index = this.selectedValues.indexOf(value);
      
      if (index === -1) {
        this.selectedValues = [...this.selectedValues, value];
      } else {
        this.selectedValues = this.selectedValues.filter(v => v !== value);
      }
      
      this.onChange(this.selectedValues);
    } else {
      this.selectedValue = option[this.valueKey];
      this.searchText = option[this.labelKey];
      this.onChange(this.selectedValue);
      this.isOpen = false;
    }
    this.onTouch();
    this.selectionChange.emit({ value: this.selectedValue });
    this.interactingWithDropdown = false;
  }

  // Clear selection
  clearSelection(event: Event) {
    event.stopPropagation();
    if (this.multiple) {
      this.selectedValues = [];
      this.onChange([]);
    } else {
      this.selectedValue = null;
      this.searchText = '';
      this.onChange(null);
    }
    this.onTouch();
    this.selectionChange.emit({ value: this.multiple ? [] : null });
  }

  isSelected(option: any): boolean {
    const value = option[this.valueKey];
    return this.multiple 
      ? this.selectedValues.includes(value)
      : this.selectedValue === value;
  }

  getSelectedLabel(): string {
    if (this.multiple) {
      return this.selectedValues.length 
        ? `${this.selectedValues.length} selected`
        : this.placeholder;
    }
    
    if (!this.selectedValue && this.defaultOption) {
      return this.defaultOption.label;
    }
    const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
    return selected ? selected[this.labelKey] : this.placeholder;
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.isOpen = true;
        this.highlightedIndex = 0;
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1, 
          this.filteredOptions.length - 1
        );
        event.preventDefault();
        this.scrollToHighlighted();
        break;

      case 'ArrowUp':
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        event.preventDefault();
        this.scrollToHighlighted();
        break;

      case 'Enter':
        if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
          this.selectOption(this.filteredOptions[this.highlightedIndex]);
          (event.target as HTMLElement).blur();
          event.preventDefault();
        }
        break;

      case 'Escape':
        this.isOpen = false;
        this.highlightedIndex = -1;
        event.preventDefault();
        break;
    }
  }

  private scrollToHighlighted(): void {
    setTimeout(() => {
      const container = document.querySelector('.options-container');
      const highlighted = document.querySelector('.option.highlighted');
      
      if (container && highlighted) {
        const containerRect = container.getBoundingClientRect();
        const highlightedRect = highlighted.getBoundingClientRect();

        if (highlightedRect.bottom > containerRect.bottom) {
          container.scrollTop += highlightedRect.bottom - containerRect.bottom;
        } else if (highlightedRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - highlightedRect.top;
        }
      }
    });
  }

  ngOnChanges(changes: any): void {
    if (changes.options && !changes.options.firstChange) {
      if (!this.multiple && this.selectedValue) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        if (selectedOption) {
          this.searchText = selectedOption[this.labelKey];
        }
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
      this.interactingWithDropdown = false;
      if (!this.multiple) {
        const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        this.searchText = selected ? selected[this.labelKey] : '';
        
        // Reset width when closing dropdown
        if (this.focusWidthPx) {
          this.elementRef.nativeElement.style.width = '';
        }
      }
    }
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getDisplayText(): string {
    if (this.multiple) {
      const selectedCount = this.selectedValues.length;
      if (selectedCount === 0) return this.placeholder;
      
      const selectedOptions = this.options.filter(opt => 
        this.selectedValues.includes(opt[this.valueKey])
      );
      
      if (selectedCount === 1) {
        return selectedOptions[0][this.labelKey];
      }
      
      return `${selectedCount} items selected`;
    }
    
    if (!this.selectedValue && this.defaultOption) {
      return this.defaultOption.label;
    }
    
    const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
    return selected ? selected[this.labelKey] : this.placeholder;
  }

  formatText(input: string): string {
    if (!input) return '';
    let text = input.replace(/&nbsp;/g, ' ');
    text = text.replace(/<(?!\/?b\b)[^>]*>/gi, '');
    text = text.replace(/\s{2,}/g, ' ').trim();
    return text;
  }
}