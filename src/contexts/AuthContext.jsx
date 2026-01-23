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

  const login = (username, password) => {
    console.log('Auth login called with:', { username, password });
    const passwords = getPasswords();
    console.log('Current passwords:', passwords);

    // Validar credenciales
    if (username.toLowerCase() === 'admin' && password === passwords.admin) {
      console.log('Admin login successful');
      const user = { username: 'admin' };
      dispatch({ type: 'LOGIN', payload: { user, role: 'admin' } });
      return true;
    }

    if (username.toLowerCase() === 'empleado' && password === passwords.employee) {
      console.log('Employee login successful');
      const user = { username: 'empleado' };
      dispatch({ type: 'LOGIN', payload: { user, role: 'employee' } });
      return true;
    }

    console.log('Login failed - credentials dont match');
    return false;
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem(STORAGE_KEY);
  };

  const setPasswords = (adminPassword, employeePassword) => {
    console.log('setPasswords called. auth state:', state);
    if (!state.isAuthenticated || state.role !== 'admin') {
      console.warn('setPasswords blocked: user not admin or not authenticated', state);
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

    try {
      localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
      console.log('Passwords updated in localStorage:', passwords);

      // Intentar exportar las contraseñas a un archivo en el escritorio
      const exportPasswordsFile = async () => {
        try {
          const content = `admin:${passwords.admin}\nemployee:${passwords.employee}\nupdated:${new Date().toISOString()}\n`;

          // Si el File System Access API está disponible, solicitar carpeta (sugerir Escritorio)
          if (window.showDirectoryPicker) {
            const dirHandle = await window.showDirectoryPicker({ startIn: 'desktop' }).catch(() => null);
            if (dirHandle) {
              const folderHandle = await dirHandle.getDirectoryHandle('contraseñas POS', { create: true });
              const fileName = `contraseñas_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
              const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(content);
              await writable.close();
              toast({ title: 'Contraseñas guardadas', description: `Archivo creado en carpeta 'contraseñas POS'` });
              return;
            }
          }

          // Fallback: descargar archivo para que el usuario lo guarde manualmente
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contraseñas_POS_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast({ title: 'Contraseñas exportadas', description: 'Descarga iniciada (guarda el archivo en tu Escritorio si lo deseas).' });
        } catch (err) {
          console.error('Error exporting passwords file:', err);
          toast({ title: 'Advertencia', description: 'No se pudo guardar el archivo automáticamente. Se actualizó la configuración.' });
        }
      };

      // Ejecutar export en background (no await para no bloquear)
      exportPasswordsFile();

      toast({
        title: 'Éxito',
        description: 'Contraseñas actualizadas correctamente',
      });
      return true;
    } catch (e) {
      console.error('Error saving passwords:', e);
      toast({
        title: 'Error',
        description: 'No se pudo guardar las contraseñas',
        variant: 'destructive',
      });
      return false;
    }
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
