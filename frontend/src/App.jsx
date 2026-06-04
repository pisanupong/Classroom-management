import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assignments from './pages/Assignments';
import CreateAssignment from './pages/CreateAssignment';
import AssignmentDetail from './pages/AssignmentDetail';
import Calendar from './pages/Calendar';
import DailyHomework from './pages/DailyHomework';
import UserManagement from './pages/UserManagement';
import Leaderboard from './pages/Leaderboard';
import QuizList from './pages/QuizList';
import CharacterEditor from './pages/CharacterEditor';
import Chat from './pages/Chat';
import TakeQuiz from './pages/TakeQuiz';
import QuizResult from './pages/QuizResult';
import CreateQuiz from './pages/CreateQuiz';
import Treasury from './pages/Treasury';
import RewardStore from './pages/RewardStore';
import VocabBattle from './pages/VocabBattle';
import BattleGame from './pages/BattleGame';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
            <Route path="/assignments/create" element={<ProtectedRoute><CreateAssignment /></ProtectedRoute>} />
            <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/daily-homework" element={<ProtectedRoute><DailyHomework /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><QuizList /></ProtectedRoute>} />
            <Route path="/quiz/create" element={<ProtectedRoute><CreateQuiz /></ProtectedRoute>} />
            <Route path="/quiz/:id/take" element={<ProtectedRoute><TakeQuiz /></ProtectedRoute>} />
            <Route path="/quiz/:id/result" element={<ProtectedRoute><QuizResult /></ProtectedRoute>} />
            <Route path="/quiz/:id/leaderboard" element={<ProtectedRoute><QuizResult /></ProtectedRoute>} />
            <Route path="/character" element={<ProtectedRoute><CharacterEditor /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/treasury" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><RewardStore /></ProtectedRoute>} />
            <Route path="/vocab-battle" element={<ProtectedRoute><VocabBattle /></ProtectedRoute>} />
            <Route path="/vocab-battle/:id" element={<ProtectedRoute><BattleGame /></ProtectedRoute>} />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
