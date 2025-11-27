import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RoleService, MenuPermissions } from '../../../services/role.service';
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
  showQuotationMenu: boolean = false;
  showDispatchQuotationMenu: boolean = false;
  showEmployeeMenu: boolean = false;
  isMobileMenuOpen: boolean = false;
  private authSubscription: Subscription;
  permissions: MenuPermissions = {
    canViewCategory: false,
    canViewProduct: false,
    canViewCustomer: false,
    canViewEmployee: false,
    canViewMachine: false,
    canViewTransport: false,
    canViewBrand: false,
    canViewUser: false,
    canViewEnquiry: false,
    canViewFollowup: false,
    canViewPayment: false,
    canViewPurchase: false,
    canViewPurchaseReturn: false,
    canViewSale: false,
    canViewSaleReturn: false,
    canViewQuotation: false,
    canViewDispatchQuotation: false,
    canViewEmployeeWithdraw: false,
    canViewAttendance: false,
    canViewAllAttendance: false,
    canViewEmployeeOrder: false,
    canViewBatch: false
  };

  constructor(
    private authService: AuthService,
    private roleService: RoleService,
    private router: Router
  ) {
    this.authSubscription = this.authService.authState$.subscribe(
      (isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
        if (isAuthenticated) {
          this.permissions = this.roleService.getMenuPermissions();
        }
      }
    );
  }

  ngOnInit(): void {
    this.authService.authState$.subscribe(
      state => {
        this.isAuthenticated = state;
        
        if (state) {
          this.permissions = this.roleService.getMenuPermissions();
        }
        
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
      this.showQuotationMenu = false;
      this.showDispatchQuotationMenu = false;
      this.showEmployeeMenu = false;
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
    this.showQuotationMenu = false;
    this.showDispatchQuotationMenu = false;
    this.showEmployeeMenu = false;
  }

  toggleTransactionMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showTransactionMenu = !this.showTransactionMenu;
    this.showMasterMenu = false;
    this.showQuotationMenu = false;
    this.showDispatchQuotationMenu = false;
    this.showEmployeeMenu = false;
  }

  toggleQuotationMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showQuotationMenu = !this.showQuotationMenu;
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
    this.showDispatchQuotationMenu = false;
    this.showEmployeeMenu = false;
  }

  toggleDispatchQuotationMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDispatchQuotationMenu = !this.showDispatchQuotationMenu;
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
    this.showQuotationMenu = false;
    this.showEmployeeMenu = false;
  }

  toggleEmployeeMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showEmployeeMenu = !this.showEmployeeMenu;
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
    this.showQuotationMenu = false;
    this.showDispatchQuotationMenu = false;
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

  isQuotationActive(): boolean {
    const currentUrl = this.router.url;
    return ['/quotation', '/quotation/order'].some(path => 
      currentUrl.includes(path)
    );
  }

  isDispatchQuotationActive(): boolean {
    const currentUrl = this.router.url;
    return ['/quotation/dispatch-list'].some(path => 
      currentUrl.includes(path)
    );
  }

  isEmployeeActive(): boolean {
    const currentUrl = this.router.url;
    return ['/attendance', '/attendance/all', '/employee-withdraw'].some(path => 
      currentUrl.includes(path)
    );
  }

  closeAllMenus(): void {
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
    this.showQuotationMenu = false;
    this.showDispatchQuotationMenu = false;
    this.showEmployeeMenu = false;
  }

  hasMasterMenuItems(): boolean {
    return this.roleService.hasMasterMenuItems();
  }

  hasTransactionMenuItems(): boolean {
    return this.roleService.hasTransactionMenuItems();
  }

  hasDispatchQuotationMenuItems(): boolean {
    return this.roleService.hasDispatchQuotationMenuItems();
  }

  hasEmployeeMenuItems(): boolean {
    return this.roleService.hasEmployeeMenuItems();
  }

  getUserDisplayName(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  }

  getUserRoles(): string {
    const roles = this.authService.getUserRoles();
    return roles.join(', ') || 'No roles';
  }

  logout(): void {
    this.authService.logout();
    // Force hard refresh to bypass all cache like Ctrl+Shift+F5
    window.location.href = window.location.origin + '/login?_t=' + new Date().getTime();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isStaffAdmin(): boolean {
    return this.authService.isStaffAdmin();
  }

  isProductManager(): boolean {
    return this.authService.isProductManager();
  }

  canViewMenu(menuType: string): boolean {
    if (this.isAdmin() || this.isStaffAdmin()) return true;
    
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