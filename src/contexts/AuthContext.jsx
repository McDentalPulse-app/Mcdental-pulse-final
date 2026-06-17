import React, { createContext, useState, useContext, useEffect } from "react";
import { USERS } from "../data/initialData";
import { getUsuariosPassword } from "../services/firestore/usuariosService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  const login = async (username, password) => {
    setLoadingAuth(true);
    try {
      const usuarioBase = USERS.find((x) => x.user === username);
      if (!usuarioBase) {
        throw new Error("Usuario o contraseña incorrectos");
      }

      const usuariosPasswordList = await getUsuariosPassword();
      const accesoFirebase = usuariosPasswordList.find((x) => x.userId === usuarioBase.id);

      const passwordValida = accesoFirebase
        ? accesoFirebase.password === password
        : usuarioBase.pass === password;

      if (passwordValida) {
        setUser({
          ...usuarioBase,
          accesoFirebase
        });
        return true;
      } else {
        throw new Error("Usuario o contraseña incorrectos");
      }
    } catch (error) {
      throw error;
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, login, logout, loadingAuth, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};