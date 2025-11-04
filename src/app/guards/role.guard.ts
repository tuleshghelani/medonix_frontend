import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const requiredRoles = route.data['roles'] as Array<string>;
    
    if (!requiredRoles) return true;
    
    const hasRequiredRole = requiredRoles.some(role => 
      this.authService.hasRole(role)
    );

    if (!hasRequiredRole) {
      this.router.navigate(['/category']);
      return false;
    }

    return true;
  }
} 