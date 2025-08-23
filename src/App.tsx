// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth'; // Ensure useAuth.tsx is correct

// Layout
import MainLayout from './components/layout/MainLayout'; // Assuming App.tsx is in src/

// Pages
import CalculatorPage from './pages/CalculatorPage';
import SignInPage from './pages/SignInPage';       
import SignUpPage from './pages/SignUpPage';       
import AdminDashboardPage from './pages/AdminDashboardPage'; 
import CustomerDashboardPage from './pages/CustomerDashboardPage'; // For Customer Dashboard
import ForgotPasswordPage from './pages/ForgotPasswordPage'; // For Forgot Password
import NotFoundPage from './pages/NotFoundPage';
import {Toaster} from 'react-hot-toast';             // For 404
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';
import ContactUsPage from './pages/ContactUsPage';
import AboutUsPage from './pages/AboutUsPage';
import PricingPage from './pages/PricingPage';
import AddVendor from './pages/AddVendor';
import AddPrices from './pages/AddPrices';
import UserSelect from './pages/UserSelect';
import BiddingPage from './pages/BiddingPage';
import VehicleInfoPage from './pages/VehicleInfoPage';


export const PrivateRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-20 text-gray-600">Loading...</div>; // Replace with spinner if needed
  }

  return (isAuthenticated) ? <>{children}</> : <Navigate to="/signin" replace />;
};


export const PublicRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-20 text-gray-600">Loading...</div>;
  }

  return (isAuthenticated)? <Navigate to="/compare" replace /> : <>{children}</>;
};
function App() {
  return (
    <AuthProvider> {/* AuthProvider now wraps everything */}
        <Router>
        <Toaster />
        <Routes>
          {/* --- PROTECTED ROUTES (require login) --- */}
          <Route 
            path="/addvendor" 
            element={
              <MainLayout>
                <PrivateRoute>
                  <AddVendor />
                </PrivateRoute>
              </MainLayout>
            } 
          />


          <Route 
            path="/addprice" 
            element={
              <MainLayout>
                <PublicRoute>
                  <AddPrices />
                </PublicRoute>
           
              </MainLayout>
            } 
          />

          <Route 
            path="/compare" 
            element={
              <MainLayout>
                <PrivateRoute>
                  <CalculatorPage />
                </PrivateRoute>
              </MainLayout>
            } 
          />
          <Route 
            path="/admin/dashboard" 
            element={
              <MainLayout>
                <PrivateRoute> {/* Assuming only authenticated users (admins) see this */}
                  <AdminDashboardPage />
                </PrivateRoute>
              </MainLayout>
            } 
          />
          <Route 
            path="/dashboard" // Example for Customer Dashboard
            element={
              <MainLayout>
                <PrivateRoute>
                  <CustomerDashboardPage />
                </PrivateRoute>
              </MainLayout>
            } 
          /> 

          <Route 
            path="/profile" // Example for Customer Dashboard
            element={
              <MainLayout>
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              </MainLayout>
            } 
          /> 



           <Route 
            path="/addbid" // Example for Customer Dashboard
            element={
              <MainLayout>
                <PrivateRoute>
                  <BiddingPage />
                </PrivateRoute>
              </MainLayout>
            } 
          /> 

          {/* --- PUBLIC ROUTES --- */}
          
          <Route path="/signin" element={<MainLayout><PublicRoute><SignInPage /></PublicRoute></MainLayout>} />
          <Route path="/signup" element={<MainLayout><PublicRoute><SignUpPage /></PublicRoute></MainLayout>} />
          <Route path="/userselect" element={<MainLayout><PublicRoute><UserSelect /></PublicRoute></MainLayout>} />
          <Route path="/forgot-password" element={<MainLayout><PublicRoute><ForgotPasswordPage /></PublicRoute></MainLayout>} />
          <Route path='/' element={<LandingPage />} />
          <Route path='/contact' element={<MainLayout><ContactUsPage /></MainLayout>} />
          <Route path='/about' element={<MainLayout><AboutUsPage /></MainLayout>} />
          
          <Route path='/pricing' element={<MainLayout><PricingPage /></MainLayout>} />
          <Route path='/vehicle-info' element={<MainLayout><VehicleInfoPage /></MainLayout>} />
          
          {/* --- CATCH-ALL 404 ROUTE (MUST BE LAST) --- */}
          <Route 
            path="*" 
            element={
              <MainLayout>
                <NotFoundPage />
              </MainLayout>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;