import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

const AuthContext = createContext(null);

const STORAGE_KEY = 'ferrePOS_auth';
const PASSWORDS_KEY = 'ferrePOS_passwords';

const initialState = {
  isAuthenticated: false,
  user: null,
  role: null, // 'admin' | 'employee'
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      return {
        isAuthenticated: true,
        user: action.payload.user,
        role: action.payload.role,
      };
    case 'LOGOUT':
      return initialState;
    case 'RESTORE_SESSION':
      return action.payload;
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restaurar sesión al cargar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        dispatch({ type: 'RESTORE_SESSION', payload: JSON.parse(saved) });
      } catch (e) {
        console.error('Error restoring session:', e);
      }
    }
  }, []);

  // Guardar sesión cuando cambia
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (username, password) => {
    const passwords = getPasswords();

    // Validar credenciales
    if (username.toLowerCase() === 'admin' && password === passwords.admin) {
      const user = { username: 'admin' };
      dispatch({ type: 'LOGIN', payload: { user, role: 'admin' } });
      return true;
    }

    if (username.toLowerCase() === 'empleado' && password === passwords.employee) {
      const user = { username: 'empleado' };
      dispatch({ type: 'LOGIN', payload: { user, role: 'employee' } });
      return true;
    }

    return false;
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem(STORAGE_KEY);
  };

  const getPasswords = () => {
    const saved = localStorage.getItem(PASSWORDS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading passwords:', e);
      }
    }
    // Contraseñas por defecto
    return {
      admin: 'admin',
      employee: '1234',
    };
  };

  const setPasswords = (adminPassword, employeePassword) => {
    if (!state.isAuthenticated || state.role !== 'admin') {
      toast({
        title: 'Error',
        description: 'Solo el administrador puede cambiar contraseñas',
        variant: 'destructive',
      });
      return false;
    }

    if (!adminPassword?.trim() || !employeePassword?.trim()) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no pueden estar vacías',
        variant: 'destructive',
      });
      return false;
    }

    const passwords = {
      admin: adminPassword.trim(),
      employee: employeePassword.trim(),
    };

    localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
    toast({
      title: 'Éxito',
      description: 'Contraseñas actualizadas correctamente',
    });
    return true;
  };

  const isAdmin = state.isAuthenticated && state.role === 'admin';
  const isEmployee = state.isAuthenticated && state.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        logout,
        isAdmin,
        isEmployee,
        getPasswords,
        setPasswords,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
};
