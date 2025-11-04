import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isAuthenticated: boolean = false;
  showMasterMenu: boolean = false;
  showTransactionMenu: boolean = false;
  showQuotationMenu: boolean = false; // Add quotation menu flag
  isMobileMenuOpen: boolean = false;
  private authSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.authSubscription = this.authService.authState$.subscribe(
      (isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
      }
    );
  }

  ngOnInit(): void {
    this.authService.authState$.subscribe(
      state => {
        this.isAuthenticated = state;
        
        // Check if user is authenticated but roles are missing
        if (this.isAuthenticated && !localStorage.getItem('userRoles')) {
          this.authService.logout();
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.mobile-menu-toggle')) {
      this.showMasterMenu = false;
      this.showTransactionMenu = false;
      this.showQuotationMenu = false; // Close quotation menu
      if (!target.closest('.nav-links')) {
        this.isMobileMenuOpen = false;
      }
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleMasterMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showMasterMenu = !this.showMasterMenu;
    this.showTransactionMenu = false;
    this.showQuotationMenu = false; // Close quotation menu
  }

  toggleTransactionMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showTransactionMenu = !this.showTransactionMenu;
    this.showMasterMenu = false;
    this.showQuotationMenu = false; // Close quotation menu
  }

  // Add toggleQuotationMenu method
  toggleQuotationMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showQuotationMenu = !this.showQuotationMenu;
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
  }

  isMasterActive(): boolean {
    const currentUrl = this.router.url;
    return ['/category', '/product', '/customer', '/employee'].some(path => 
      currentUrl.includes(path)
    );
  }

  isTransactionActive(): boolean {
    const currentUrl = this.router.url;
    return ['/purchase', '/sale', '/profit', '/daily-profit'].some(path => 
      currentUrl.includes(path)
    );
  }

  // Add isQuotationActive method
  isQuotationActive(): boolean {
    const currentUrl = this.router.url;
    return ['/quotation', '/quotation/order'].some(path => 
      currentUrl.includes(path)
    );
  }

  logout(): void {
    this.authService.logout();
    // Force hard refresh to bypass all cache like Ctrl+Shift+F5
    window.location.href = window.location.origin + '/login?_t=' + new Date().getTime();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isProductManager(): boolean {
    return this.authService.isProductManager();
  }

  canViewMenu(menuType: string): boolean {
    if (this.isAdmin()) return true;
    
    if (this.isProductManager()) {
      switch (menuType) {
        case 'category':
        case 'product':
        case 'quotation':
        case 'attendance':
          return true;
        default:
          return false;
      }
    }
    
    return false;
  }
}