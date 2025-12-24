import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, forwardRef, ElementRef, HostListener, OnDestroy, ViewChild, AfterViewInit, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Renderer2, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface SelectOption {
  [key: string]: any;
}

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchableSelectComponent implements ControlValueAccessor, OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() options: SelectOption[] = [];
  @Input() labelKey: string = 'name';
  @Input() valueKey: string = 'id';
  @Input() placeholder: string = 'Select an option';
  @Input() defaultOption: { label: string; value: any } | null = null;
  @Input() searchPlaceholder: string = 'Search...';
  @Input() multiple = false;
  @Input() allowClear = true;
  @Input() focusWidthPx?: number;
  @Input() maxHeight: string = '300px';
  @Input() virtualScroll = true; // Default to true for performance
  @Input() searchDebounceMs = 300;
  @Input() initialDisplayLimit: number = 100; // Limit initial display for large lists
  @Input() virtualScrollItemHeight: number = 40; // Height of each option item in pixels
  @Input() virtualScrollBuffer: number = 25; // Number of items to render outside viewport (increased for smoother scrolling)

  @Output() selectionChange = new EventEmitter<any>();

  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLDivElement>;
  @ViewChild('dropdown', { static: false }) dropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('optionsContainer', { static: false }) optionsContainer!: ElementRef<HTMLDivElement>;

  searchText: string = '';
  isOpen: boolean = false;
  selectedValue: any = '';
  selectedValues: any[] = [];
  filteredOptions: SelectOption[] = [];
  displayedOptions: SelectOption[] = []; // Only visible items for virtual scrolling
  highlightedIndex: number = -1;
  interactingWithDropdown = false;
  isPlaceholderVisible: boolean = true;
  
  // Virtual scrolling properties
  scrollTop: number = 0;
  containerHeight: number = 200;
  startIndex: number = 0;
  endIndex: number = 0;
  totalHeight: number = 0;
  offsetY: number = 0;
  private scrollListener?: () => void;
  private isUpdatingScroll: boolean = false;
  private lastScrollTop: number = 0;

  onChange: (value: any) => void = () => {};
  onTouch: () => void = () => {};

  // Memory management
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private clickOutsideListener: (() => void) | null = null;
  private isFirstClick: boolean = true;
  private sanitizedHtmlCache: Map<string, SafeHtml> = new Map();
  private lastSearchText: string = '';
  private lastFilteredOptions: SelectOption[] = [];
  private originalStyles: Map<HTMLElement, { [key: string]: string }> = new Map();
  private labelCache: Map<SelectOption, string> = new Map();
  private animationFrameId: number | null = null;

  constructor(
    private elementRef: ElementRef,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Don't initialize all options at once for large lists
    // Only process them when needed
    this.filteredOptions = [];
    this.displayedOptions = [];
    
    // Set up click outside listener using Renderer2 for proper cleanup
    this.clickOutsideListener = this.renderer.listen('document', 'click', (event: Event) => {
      this.onClickOutside(event);
    });
    
    // Pre-cache labels for all options (do this asynchronously)
    if (this.options.length > 0) {
      requestAnimationFrame(() => {
        this.preCacheLabels();
      });
    }
  }
  
  private preCacheLabels(): void {
    // Cache labels for a batch of options per frame to avoid blocking
    const batchSize = 100;
    let processed = 0;
    
    const processBatch = () => {
      const end = Math.min(processed + batchSize, this.options.length);
      for (let i = processed; i < end; i++) {
        const option = this.options[i];
        if (!this.labelCache.has(option)) {
          this.labelCache.set(option, this.getOptionLabel(option));
        }
      }
      processed = end;
      
      if (processed < this.options.length) {
        this.animationFrameId = requestAnimationFrame(processBatch);
      }
    };
    
    if (this.options.length > 0) {
      this.animationFrameId = requestAnimationFrame(processBatch);
    }
  }

  ngAfterViewInit(): void {
    // Set initial display text in contenteditable div
    const timeoutId = setTimeout(() => {
      if (this.searchInput?.nativeElement && !this.isOpen) {
        this.searchInput.nativeElement.textContent = this.getDisplayText();
        this.cdr.markForCheck();
      }
    }, 0);
    this.timeouts.push(timeoutId);
  }

  ngOnDestroy(): void {
    // Close dropdown first to prevent any pending operations
    this.isOpen = false;
    this.interactingWithDropdown = false;
    
    // Cancel any pending animation frames
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove scroll listener
    if (this.scrollListener) {
      this.scrollListener();
      this.scrollListener = undefined;
    }
    
    // Clear all timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];
    
    // Clear debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    
    // Remove click outside listener
    if (this.clickOutsideListener) {
      this.clickOutsideListener();
      this.clickOutsideListener = null;
    }
    
    // Revert all style manipulations
    this.revertAllStyles();
    
    // Clear all arrays and references
    this.options = [];
    this.filteredOptions = [];
    this.displayedOptions = [];
    this.selectedValues = [];
    this.lastFilteredOptions = [];
    
    // Clear all caches aggressively
    this.sanitizedHtmlCache.clear();
    this.labelCache.clear();
    this.originalStyles.clear();
    
    // Clear all string properties
    this.searchText = '';
    this.lastSearchText = '';
    
    // Reset all state completely
    this.isPlaceholderVisible = true;
    this.isFirstClick = true;
    this.highlightedIndex = -1;
    this.selectedValue = null;
    this.selectedValues = [];
    
    // Nullify callbacks
    this.onChange = () => {};
    this.onTouch = () => {};
    
    // Clear DOM references
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.textContent = '';
    }
    
    // Detach change detector to prevent any lingering change detection cycles
    this.cdr.detach();
    
    // Complete EventEmitter to remove all subscribers and prevent memory leaks
    if (this.selectionChange && typeof (this.selectionChange as any).complete === 'function') {
      (this.selectionChange as any).complete();
    }
    
    // Clear ViewChild references to help garbage collection
    // Using type assertion to allow undefined assignment
    (this as any).searchInput = undefined;
    (this as any).dropdown = undefined;
    (this as any).optionsContainer = undefined;
  }
  
  private revertAllStyles(): void {
    this.originalStyles.forEach((styles, element) => {
      Object.keys(styles).forEach(prop => {
        if (styles[prop]) {
          (element.style as any)[prop] = styles[prop];
        } else {
          (element.style as any)[prop] = '';
        }
      });
      // Remove custom classes
      element.classList.remove('expanded', 'custom-width');
    });
    this.originalStyles.clear();
  }
  
  hasSelection(): boolean {
    return this.multiple ? this.selectedValues.length > 0 : !!this.selectedValue;
  }
  
  onDropdownPointerDown(event?: Event): void {
    // Prevent input blur from closing dropdown prematurely on mobile
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.interactingWithDropdown = true;
  }

  onInputClick(event: MouseEvent | TouchEvent): void {
    // Prevent form submission
    event.preventDefault();
    event.stopPropagation();
    
    // Clear placeholder text on first click
    if (this.isFirstClick || this.isPlaceholderVisible) {
      const currentText = this.getDisplayText();
      const isPlaceholder = !this.hasSelection() && 
        (currentText === this.placeholder || 
         (this.defaultOption && currentText === this.defaultOption.label));
      
      if (isPlaceholder) {
        this.searchText = '';
        this.isPlaceholderVisible = false;
        this.isFirstClick = false;
        
        // Clear the contenteditable div
        const timeoutId = setTimeout(() => {
          if (this.searchInput?.nativeElement) {
            this.searchInput.nativeElement.textContent = '';
            this.searchInput.nativeElement.focus();
            this.cdr.markForCheck();
          }
        }, 0);
        this.timeouts.push(timeoutId);
      }
    }
  }

  
  scrollOptions(direction: 'up' | 'down', event?: MouseEvent | TouchEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    const container = this.optionsContainer?.nativeElement;
    if (!container) return;

    const scrollAmount = 160;
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
    this.cdr.markForCheck();
  }

  writeValue(value: any): void {
    if (this.multiple) {
      this.selectedValues = value || [];
    } else {
      this.selectedValue = value;
      if (value) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === value);
        if (selectedOption) {
          this.searchText = this.getOptionLabel(selectedOption);
          this.isPlaceholderVisible = false;
          this.isFirstClick = false;
          
          // Update the contenteditable div
          if (this.searchInput?.nativeElement) {
            this.searchInput.nativeElement.textContent = this.searchText;
          }
        }
      } else {
        this.isPlaceholderVisible = true;
        this.isFirstClick = true;
        this.searchText = '';
        
        // Update the contenteditable div with placeholder
        if (this.searchInput?.nativeElement) {
          this.searchInput.nativeElement.textContent = this.getDisplayText();
        }
      }
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  toggleDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Clear placeholder on first interaction
      if (this.isFirstClick || this.isPlaceholderVisible) {
        const currentText = this.getDisplayText();
        const isPlaceholder = !this.hasSelection() && 
          (currentText === this.placeholder || 
           (this.defaultOption && currentText === this.defaultOption.label));
        
        if (isPlaceholder) {
          this.searchText = '';
          this.isPlaceholderVisible = false;
          this.isFirstClick = false;
        }
      }
      
      // Use requestAnimationFrame to avoid blocking UI
      requestAnimationFrame(() => {
        this.filterOptions();
        
        // Focus the search input when dropdown opens
        setTimeout(() => {
          if (this.searchInput?.nativeElement) {
            this.searchInput.nativeElement.textContent = this.searchText;
            this.searchInput.nativeElement.focus();
            this.cdr.markForCheck();
          }
        }, 0);
        
        // Adjust dropdown position for mobile viewport
        this.adjustDropdownPosition();
        
        // Setup virtual scrolling if enabled
        if (this.virtualScroll && this.filteredOptions.length > this.initialDisplayLimit) {
          this.setupVirtualScroll();
        }
      });
    } else {
      // Cleanup virtual scroll when closing
      if (this.scrollListener) {
        this.scrollListener();
        this.scrollListener = undefined;
      }
    }
    this.cdr.markForCheck();
  }

  onFocus(): void {
    // Clear placeholder text on first focus
    if (this.isFirstClick || this.isPlaceholderVisible) {
      const currentText = this.searchInput?.nativeElement?.textContent || this.getDisplayText();
      const isPlaceholder = !this.hasSelection() && 
        (currentText === this.placeholder || 
         (this.defaultOption && currentText === this.defaultOption.label) ||
         !currentText.trim());
      
      if (isPlaceholder) {
        this.searchText = '';
        this.isPlaceholderVisible = false;
        this.isFirstClick = false;
        
        // Clear the contenteditable div
        const timeoutId = setTimeout(() => {
          if (this.searchInput?.nativeElement) {
            this.searchInput.nativeElement.textContent = '';
            this.cdr.markForCheck();
          }
        }, 0);
        this.timeouts.push(timeoutId);
      } else if (this.searchInput?.nativeElement && this.searchText) {
        // Set the search text if it exists
        this.searchInput.nativeElement.textContent = this.searchText;
      }
    }
    
    this.isOpen = true;
    this.highlightedIndex = -1;
    
    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      this.filterOptions();
      
      // Apply custom width on focus if specified
      if (this.focusWidthPx) {
        this.applyFocusWidth();
      }
      
      // Adjust dropdown position for mobile viewport
      this.adjustDropdownPosition();
      
      // Setup virtual scrolling if enabled
      if (this.virtualScroll && this.filteredOptions.length > this.initialDisplayLimit) {
        this.setupVirtualScroll();
      }
    });
    
    this.cdr.markForCheck();
  }
  
  private adjustDropdownPosition(): void {
    // Wait for dropdown to render
    const timeoutId = setTimeout(() => {
      if (!this.dropdown?.nativeElement || !this.isOpen) return;
      
      const dropdown = this.dropdown.nativeElement.querySelector('.select-dropdown') as HTMLElement;
      if (!dropdown) return;
      
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        // On mobile, use fixed positioning (handled by CSS)
        // Just ensure it's visible
        const viewportHeight = window.innerHeight;
        const maxHeight = Math.min(parseInt(this.maxHeight) || 200, viewportHeight * 0.6);
        dropdown.style.maxHeight = `${maxHeight}px`;
      } else {
        // On desktop, check if dropdown would go off-screen
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // If not enough space below but enough above, position above
        if (spaceBelow < dropdownRect.height && spaceAbove > dropdownRect.height) {
          dropdown.style.top = 'auto';
          dropdown.style.bottom = 'calc(100% + 6px)';
          dropdown.style.transform = 'translateY(100%)';
        } else {
          dropdown.style.top = 'calc(100% + 6px)';
          dropdown.style.bottom = 'auto';
          dropdown.style.transform = 'none';
        }
      }
      
      // Setup virtual scrolling after dropdown is positioned
      if (this.virtualScroll && this.filteredOptions.length > this.initialDisplayLimit) {
        this.setupVirtualScroll();
      }
      
      this.cdr.markForCheck();
    }, 0);
    this.timeouts.push(timeoutId);
  }
  
  private applyFocusWidth(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    
    // Store and apply styles to parent container
    const parentContainer = element.closest('.select-group') as HTMLElement;
    if (parentContainer && !this.originalStyles.has(parentContainer)) {
      this.originalStyles.set(parentContainer, {
        minWidth: parentContainer.style.minWidth,
        width: parentContainer.style.width
      });
      parentContainer.style.minWidth = `${this.focusWidthPx}px`;
      parentContainer.style.width = `${this.focusWidthPx}px`;
      parentContainer.style.transition = 'all 0.3s ease';
      parentContainer.classList.add('expanded');
    }
    
    // Store and apply styles to component element
    if (!this.originalStyles.has(element)) {
      this.originalStyles.set(element, {
        width: element.style.width,
        minWidth: element.style.minWidth,
        maxWidth: element.style.maxWidth
      });
      element.style.width = `${this.focusWidthPx}px`;
      element.style.minWidth = `${this.focusWidthPx}px`;
      element.style.maxWidth = `${this.focusWidthPx}px`;
      element.classList.add('custom-width');
    }
    
    // Store and apply styles to inner div
    const innerDiv = element.querySelector('.searchable-select') as HTMLElement;
    if (innerDiv && !this.originalStyles.has(innerDiv)) {
      this.originalStyles.set(innerDiv, {
        width: innerDiv.style.width,
        minWidth: innerDiv.style.minWidth,
        maxWidth: innerDiv.style.maxWidth
      });
      innerDiv.style.width = `${this.focusWidthPx}px`;
      innerDiv.style.minWidth = `${this.focusWidthPx}px`;
      innerDiv.style.maxWidth = `${this.focusWidthPx}px`;
    }
  }

  onBlur(): void {
    const timeoutId = setTimeout(() => {
      if (this.interactingWithDropdown) {
        return;
      }
      if (!this.multiple) {
        this.isOpen = false;
        this.highlightedIndex = -1;
        const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        this.searchText = selected ? this.getOptionLabel(selected) : '';
        
        // Update the contenteditable div with the display text
        if (this.searchInput?.nativeElement) {
          const displayText = this.getDisplayText();
          this.searchInput.nativeElement.textContent = displayText;
        }
        
        // Reset placeholder visibility if no selection
        if (!this.selectedValue) {
          this.isPlaceholderVisible = true;
          this.isFirstClick = true;
        }
        
        // Reset width on blur
        if (this.focusWidthPx) {
          this.revertFocusWidth();
        }
        this.cdr.markForCheck();
      }
    }, 200);
    this.timeouts.push(timeoutId);
  }
  
  private revertFocusWidth(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    
    // Revert parent container styles
    const parentContainer = element.closest('.select-group') as HTMLElement;
    if (parentContainer && this.originalStyles.has(parentContainer)) {
      const styles = this.originalStyles.get(parentContainer)!;
      parentContainer.style.minWidth = styles['minWidth'] || '';
      parentContainer.style.width = styles['width'] || '';
      parentContainer.classList.remove('expanded');
      this.originalStyles.delete(parentContainer);
    }
    
    // Revert component element styles
    if (this.originalStyles.has(element)) {
      const styles = this.originalStyles.get(element)!;
      element.style.width = styles['width'] || '';
      element.style.minWidth = styles['minWidth'] || '';
      element.style.maxWidth = styles['maxWidth'] || '';
      element.classList.remove('custom-width');
      this.originalStyles.delete(element);
    }
    
    // Revert inner div styles
    const innerDiv = element.querySelector('.searchable-select') as HTMLElement;
    if (innerDiv && this.originalStyles.has(innerDiv)) {
      const styles = this.originalStyles.get(innerDiv)!;
      innerDiv.style.width = styles['width'] || '';
      innerDiv.style.minWidth = styles['minWidth'] || '';
      innerDiv.style.maxWidth = styles['maxWidth'] || '';
      this.originalStyles.delete(innerDiv);
    }
  }

  onSearch(event: Event): void {
    // Prevent form submission
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.type === 'keydown' && (keyboardEvent.key === 'Enter' || keyboardEvent.keyCode === 13)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Get the current text content from the contenteditable div
    const target = event.target as HTMLElement;
    const value = (target.textContent || target.innerText || '').trim();
    
    // If multiple selection and has selected values, don't update search text
    if (this.multiple && this.selectedValues.length > 0 && !this.isOpen) {
      this.searchText = this.getDisplayText();
      return;
    }
    
    // Mark that placeholder is no longer visible once user starts typing
    if (this.isPlaceholderVisible || this.isFirstClick) {
      this.isPlaceholderVisible = false;
      this.isFirstClick = false;
    }
    
    this.searchText = value;
    
    // Implement search debouncing with caching
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    this.searchDebounceTimer = setTimeout(() => {
      this.filterOptions();
      this.isOpen = true;
      this.cdr.markForCheck();
    }, this.searchDebounceMs);
  }

  filterOptions(): void {
    // Cache check - if search text hasn't changed, return cached results
    if (this.searchText === this.lastSearchText && this.lastFilteredOptions.length > 0) {
      this.filteredOptions = this.lastFilteredOptions;
      this.updateDisplayedOptions();
      this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
      return;
    }
    
    const searchLower = this.searchText.toLowerCase().trim();
    
    if (!searchLower) {
      // Show all options (virtual scrolling will handle display)
      this.filteredOptions = [...this.options];
    } else {
      // Optimize filtering with cached labels
      const results: SelectOption[] = [];
      
      // Use more efficient filtering
      for (const option of this.options) {
        const label = this.getCachedLabel(option).toLowerCase();
        
        // Fast path: exact match at start (prioritize these)
        if (label.startsWith(searchLower)) {
          results.push(option);
          continue;
        }
        
        // Fast path: contains match
        if (label.includes(searchLower)) {
          results.push(option);
        }
      }
      
      this.filteredOptions = results.length > 0 ? results : [];
    }
    
    // Cache results
    this.lastSearchText = this.searchText;
    this.lastFilteredOptions = [...this.filteredOptions];
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    
    // Update displayed options based on virtual scrolling
    // This will limit what's rendered in the DOM
    this.updateDisplayedOptions();
    
    this.cdr.markForCheck();
  }
  
  private getCachedLabel(option: SelectOption): string {
    if (this.labelCache.has(option)) {
      return this.labelCache.get(option)!;
    }
    const label = this.getOptionLabel(option);
    this.labelCache.set(option, label);
    return label;
  }
  
  private updateDisplayedOptions(): void {
    if (!this.virtualScroll || this.filteredOptions.length <= this.initialDisplayLimit) {
      // Don't use virtual scrolling for small lists
      this.displayedOptions = this.filteredOptions;
      this.totalHeight = this.filteredOptions.length * this.virtualScrollItemHeight;
      this.offsetY = 0;
      return;
    }
    
    // Calculate visible range
    const container = this.optionsContainer?.nativeElement;
    if (!container) {
      this.displayedOptions = this.filteredOptions.slice(0, this.initialDisplayLimit);
      return;
    }
    
    // Use actual container height with fallback, ensure minimum height
    this.containerHeight = Math.max(container.clientHeight || parseInt(this.maxHeight) || 300, 200);
    const visibleCount = Math.ceil(this.containerHeight / this.virtualScrollItemHeight);
    
    // Calculate start/end with larger buffer to prevent white background
    const rawStartIndex = Math.floor(this.scrollTop / this.virtualScrollItemHeight);
    this.startIndex = Math.max(0, rawStartIndex - this.virtualScrollBuffer);
    
    // Ensure we always render enough items to fill the viewport plus buffer
    const minItems = visibleCount + (this.virtualScrollBuffer * 3);
    this.endIndex = Math.min(
      this.filteredOptions.length,
      this.startIndex + minItems
    );
    
    // Ensure we always have items to display
    if (this.endIndex - this.startIndex < visibleCount && this.filteredOptions.length > 0) {
      // Adjust startIndex if we're near the end
      this.startIndex = Math.max(0, this.filteredOptions.length - minItems);
      this.endIndex = this.filteredOptions.length;
    }
    
    this.displayedOptions = this.filteredOptions.slice(this.startIndex, this.endIndex);
    this.totalHeight = this.filteredOptions.length * this.virtualScrollItemHeight;
    this.offsetY = this.startIndex * this.virtualScrollItemHeight;
  }
  
  private setupVirtualScroll(): void {
    const container = this.optionsContainer?.nativeElement;
    if (!container || !this.virtualScroll || this.filteredOptions.length <= this.initialDisplayLimit) {
      return;
    }
    
    // Remove existing listener
    if (this.scrollListener) {
      this.scrollListener();
    }
    
    // Setup scroll listener with requestAnimationFrame for better performance
    this.scrollListener = this.renderer.listen(container, 'scroll', () => {
      // Prevent feedback loop - ignore scroll events triggered by DOM updates
      if (this.isUpdatingScroll) {
        return;
      }
      
      const newScrollTop = container.scrollTop;
      
      // Only update if scroll position changed significantly (more than 5px)
      // This prevents micro-movements from triggering updates
      if (Math.abs(newScrollTop - this.lastScrollTop) < 5) {
        return;
      }
      
      this.scrollTop = newScrollTop;
      this.lastScrollTop = newScrollTop;
      
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
      
      this.animationFrameId = requestAnimationFrame(() => {
        this.isUpdatingScroll = true;
        this.updateDisplayedOptions();
        this.cdr.markForCheck();
        
        // Reset flag after a short delay to allow DOM to settle
        setTimeout(() => {
          this.isUpdatingScroll = false;
          this.animationFrameId = null;
        }, 50);
      });
    });
    
    // Initial update
    this.scrollTop = 0;
    this.lastScrollTop = 0;
    this.updateDisplayedOptions();
    this.cdr.markForCheck();
  }
  
  onOptionsContainerScroll(event: Event): void {
    // Prevent feedback loop - ignore scroll events triggered by DOM updates
    if (this.isUpdatingScroll) {
      return;
    }
    
    const container = event.target as HTMLElement;
    const newScrollTop = container.scrollTop;
    
    // Only update if scroll position changed significantly (more than 5px)
    if (Math.abs(newScrollTop - this.lastScrollTop) < 5) {
      return;
    }
    
    this.scrollTop = newScrollTop;
    this.lastScrollTop = newScrollTop;
    
    if (this.virtualScroll && this.filteredOptions.length > this.initialDisplayLimit) {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = requestAnimationFrame(() => {
        this.isUpdatingScroll = true;
        this.updateDisplayedOptions();
        this.cdr.markForCheck();
        
        // Reset flag after a short delay to allow DOM to settle
        setTimeout(() => {
          this.isUpdatingScroll = false;
          this.animationFrameId = null;
        }, 50);
      });
    }
  }

  selectOption(option: SelectOption, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
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
      this.searchText = this.getOptionLabel(option);
      this.isPlaceholderVisible = false;
      this.isFirstClick = false;
      this.onChange(this.selectedValue);
      this.isOpen = false;
      
      // Update the contenteditable div with selected text
      if (this.searchInput?.nativeElement) {
        this.searchInput.nativeElement.textContent = this.searchText;
      }
    }
    this.onTouch();
    this.selectionChange.emit({ value: this.selectedValue });
    this.interactingWithDropdown = false;
    this.cdr.markForCheck();
  }

  clearSelection(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.multiple) {
      this.selectedValues = [];
      this.onChange([]);
    } else {
      this.selectedValue = null;
      this.searchText = '';
      this.isPlaceholderVisible = true;
      this.isFirstClick = true;
      this.onChange(null);
      if (this.searchInput?.nativeElement) {
        this.searchInput.nativeElement.textContent = this.getDisplayText();
      }
    }
    this.onTouch();
    this.selectionChange.emit({ value: this.multiple ? [] : null });
    this.cdr.markForCheck();
  }

  isSelected(option: SelectOption): boolean {
    const value = option[this.valueKey];
    return this.multiple 
      ? this.selectedValues.includes(value)
      : this.selectedValue === value;
  }
  
  trackByOptionId(index: number, option: SelectOption): any {
    return option[this.valueKey] ?? index;
  }
  
  getOptionLabel(option: SelectOption): string {
    // Check cache first
    if (this.labelCache.has(option)) {
      return this.labelCache.get(option)!;
    }
    
    const label = option[this.labelKey];
    let result: string;
    if (typeof label === 'string') {
      result = this.formatText(label);
    } else {
      result = String(label || '');
    }
    
    // Cache the result
    this.labelCache.set(option, result);
    return result;
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
    // Prevent form submission on Enter
    if (event.key === 'Enter' && !this.isOpen) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.isOpen = true;
        this.highlightedIndex = 0;
        requestAnimationFrame(() => {
          this.filterOptions();
          this.cdr.markForCheck();
        });
        event.preventDefault();
        event.stopPropagation();
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
        event.stopPropagation();
        this.scrollToHighlighted();
        break;

      case 'ArrowUp':
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        event.preventDefault();
        event.stopPropagation();
        this.scrollToHighlighted();
        break;

      case 'Enter':
        if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
          this.selectOption(this.filteredOptions[this.highlightedIndex], event);
          (event.target as HTMLElement).blur();
        }
        // Always prevent form submission
        event.preventDefault();
        event.stopPropagation();
        break;

      case 'Escape':
        this.isOpen = false;
        this.highlightedIndex = -1;
        event.preventDefault();
        event.stopPropagation();
        this.cdr.markForCheck();
        break;
    }
  }

  private scrollToHighlighted(): void {
    requestAnimationFrame(() => {
      const container = this.optionsContainer?.nativeElement;
      if (!container) return;
      
      // If using virtual scrolling, calculate scroll position based on highlighted index
      if (this.virtualScroll && this.filteredOptions.length > this.initialDisplayLimit) {
        const targetScrollTop = this.highlightedIndex * this.virtualScrollItemHeight;
        const maxScroll = this.totalHeight - this.containerHeight;
        container.scrollTop = Math.min(targetScrollTop, maxScroll);
        this.scrollTop = container.scrollTop;
        this.updateDisplayedOptions();
        this.cdr.markForCheck();
        return;
      }
      
      // Fallback to DOM-based scrolling for small lists
      const highlighted = container.querySelector('.option.highlighted') as HTMLElement;
      
      if (highlighted) {
        const containerRect = container.getBoundingClientRect();
        const highlightedRect = highlighted.getBoundingClientRect();

        if (highlightedRect.bottom > containerRect.bottom) {
          container.scrollTop += highlightedRect.bottom - containerRect.bottom;
        } else if (highlightedRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - highlightedRect.top;
        }
      }
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] && !changes['options'].firstChange) {
      // Clear filter cache when options change
      this.lastSearchText = '';
      this.lastFilteredOptions = [];
      this.labelCache.clear(); // Clear label cache when options change
      
      // Pre-cache labels asynchronously for new options
      if (this.options.length > 0) {
        requestAnimationFrame(() => {
          this.preCacheLabels();
        });
      }
      
      // Update display text if value was set before options loaded
      if (!this.multiple && this.selectedValue) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        if (selectedOption) {
          this.searchText = this.getOptionLabel(selectedOption);
          this.isPlaceholderVisible = false;
          this.isFirstClick = false;
          
          // Update the contenteditable div to show the selected product name
          const timeoutId = setTimeout(() => {
            if (this.searchInput?.nativeElement) {
              this.searchInput.nativeElement.textContent = this.searchText;
              this.cdr.markForCheck();
            }
          }, 0);
          this.timeouts.push(timeoutId);
        }
      }
      
      requestAnimationFrame(() => {
        this.filterOptions();
        this.cdr.markForCheck();
      });
    }
  }

  private onClickOutside(event: Event): void {
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.isOpen = false;
      this.interactingWithDropdown = false;
      if (!this.multiple) {
        const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        this.searchText = selected ? this.getOptionLabel(selected) : '';
        
        // Update the contenteditable div with display text
        if (this.searchInput?.nativeElement) {
          this.searchInput.nativeElement.textContent = this.getDisplayText();
        }
        
        // Reset placeholder visibility if no selection
        if (!this.selectedValue) {
          this.isPlaceholderVisible = true;
          this.isFirstClick = true;
        }
        
        // Reset width when closing dropdown
        if (this.focusWidthPx) {
          this.revertFocusWidth();
        }
      }
      this.cdr.markForCheck();
    }
  }

  sanitizeHtml(html: string): SafeHtml {
    // Cache sanitized HTML to avoid repeated sanitization
    if (this.sanitizedHtmlCache.has(html)) {
      return this.sanitizedHtmlCache.get(html)!;
    }
    
    const sanitized = this.sanitizer.bypassSecurityTrustHtml(html);
    // Limit cache size to prevent memory issues
    if (this.sanitizedHtmlCache.size > 100) {
      const firstKey = this.sanitizedHtmlCache.keys().next().value;
      if (firstKey) {
        this.sanitizedHtmlCache.delete(firstKey);
      }
    }
    this.sanitizedHtmlCache.set(html, sanitized);
    return sanitized;
  }

  getDisplayText(): string {
    // If search text is set and not a placeholder, return it
    if (this.searchText && !this.isPlaceholderVisible && !this.isFirstClick) {
      return this.searchText;
    }
    
    if (this.multiple) {
      const selectedCount = this.selectedValues.length;
      if (selectedCount === 0) return this.placeholder;
      
      const selectedOptions = this.options.filter(opt => 
        this.selectedValues.includes(opt[this.valueKey])
      );
      
      if (selectedCount === 1) {
        return this.getOptionLabel(selectedOptions[0]);
      }
      
      return `${selectedCount} items selected`;
    }
    
    if (!this.selectedValue) {
      if (this.defaultOption) {
        return this.defaultOption.label;
      }
      return this.placeholder;
    }
    
    const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
    return selected ? this.getOptionLabel(selected) : this.placeholder;
  }

  formatText(input: string): string {
    if (!input) return '';
    let text = input.replace(/&nbsp;/g, ' ');
    text = text.replace(/<(?!\/?b\b)[^>]*>/gi, '');
    text = text.replace(/\s{2,}/g, ' ').trim();
    return text;
  }
}