import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import StudentHome from './pages/StudentHome'
import ExamRoom from './pages/ExamRoom'
import ExamResult from './pages/ExamResult'
import CapabilityPortrait from './pages/CapabilityPortrait'
import WrongBook from './pages/WrongBook'
import ExamAnalysis from './pages/ExamAnalysis'
import TeacherDashboard from './pages/TeacherDashboard'
import CourseObjectiveAnalysis from './pages/CourseObjectiveAnalysis'
import AIGrading from './pages/AIGrading'
import KnowledgeGraph from './pages/KnowledgeGraph'
import SpeakingTest from './pages/SpeakingTest'
import ScanGrading from './pages/ScanGrading'
import LearningLoop from './pages/LearningLoop'
import AIQuestionGenerator from './pages/AIQuestionGenerator'
import AdaptiveLearning from './pages/AdaptiveLearning'
import ExamRecording from './pages/ExamRecording'
import Organization from './pages/Organization'
import QuestionBankManage from './pages/QuestionBankManage'
import StudentDashboard from './pages/StudentDashboard'
import Certificate from './pages/Certificate'
import CommandCenter from './pages/CommandCenter'
import MobilePreview from './pages/MobilePreview'
import LiveClassroom from './pages/LiveClassroom'
import Survey from './pages/Survey'
import Forum from './pages/Forum'
import TeacherHome from './pages/TeacherHome'
import QuestionBank from './pages/QuestionBank'
import PaperAssembly from './pages/PaperAssembly'
import ExamManagement from './pages/ExamManagement'
import GradingQueue from './pages/GradingQueue'
import SystemMonitor from './pages/SystemMonitor'
import InfoCollection from './pages/InfoCollection'
import DataImport from './pages/DataImport'
import ProctorDashboard from './pages/ProctorDashboard'
import PrintManagement from './pages/PrintManagement'
import TagManagement from './pages/TagManagement'
import ArchiveCenter from './pages/ArchiveCenter'
import AssessmentReport from './pages/AssessmentReport'
import DemoCenter from './pages/DemoCenter'
import { mountToastHost } from './components/ui'

mountToastHost()

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

function RequireAuth({ children, roles }) {
  const user = getStoredUser()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(getStoredUser)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => setUser(JSON.parse(localStorage.getItem('user') || 'null'))
    window.addEventListener('storage', handler)
    window.addEventListener('auth-changed', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('auth-changed', handler)
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout user={user} /></RequireAuth>}>
        <Route index element={<HomeByRole />} />
        <Route path="exam-room/:examId" element={<RequireAuth roles={['student']}><ExamRoom /></RequireAuth>} />
        <Route path="checkin/:examId" element={<RequireAuth roles={['student']}><InfoCollection /></RequireAuth>} />
        <Route path="result/:examId" element={<RequireAuth roles={['student']}><ExamResult /></RequireAuth>} />
        <Route path="portrait" element={<RequireAuth roles={['student']}><CapabilityPortrait /></RequireAuth>} />
        <Route path="question-bank" element={<RequireAuth roles={['teacher', 'admin']}><QuestionBank /></RequireAuth>} />
        <Route path="paper-assembly" element={<RequireAuth roles={['teacher', 'admin']}><PaperAssembly /></RequireAuth>} />
        <Route path="exam-management" element={<RequireAuth roles={['teacher', 'admin']}><ExamManagement /></RequireAuth>} />
        <Route path="data-import" element={<RequireAuth roles={['teacher', 'admin']}><DataImport /></RequireAuth>} />
        <Route path="grading" element={<RequireAuth roles={['teacher', 'admin']}><GradingQueue /></RequireAuth>} />
        <Route path="scan-grading" element={<RequireAuth roles={['teacher', 'admin']}><ScanGrading /></RequireAuth>} />
        <Route path="print-management" element={<RequireAuth roles={['teacher', 'admin']}><PrintManagement /></RequireAuth>} />
        <Route path="tag-management" element={<RequireAuth roles={['teacher', 'admin']}><TagManagement /></RequireAuth>} />
        <Route path="archive-center" element={<RequireAuth roles={['teacher', 'admin']}><ArchiveCenter /></RequireAuth>} />
        <Route path="assessment-report" element={<RequireAuth roles={['teacher', 'admin']}><AssessmentReport /></RequireAuth>} />
        <Route path="proctor-dashboard" element={<RequireAuth roles={['admin', 'teacher', 'proctor']}><ProctorDashboard /></RequireAuth>} />
        <Route path="command" element={<RequireAuth roles={['admin', 'teacher', 'proctor']}><CommandCenter /></RequireAuth>} />
        <Route path="system" element={<RequireAuth roles={['admin']}><SystemMonitor /></RequireAuth>} />
        <Route path="ai-question-generator" element={<RequireAuth roles={['teacher', 'admin']}><AIQuestionGenerator /></RequireAuth>} />
        <Route path="adaptive-learning" element={<RequireAuth roles={['student']}><AdaptiveLearning /></RequireAuth>} />
        <Route path="exam-recording" element={<RequireAuth roles={['teacher', 'admin']}><ExamRecording /></RequireAuth>} />
        <Route path="organization" element={<RequireAuth roles={['admin']}><Organization /></RequireAuth>} />
        <Route path="question-bank-manage" element={<RequireAuth roles={['teacher', 'admin']}><QuestionBankManage /></RequireAuth>} />
        <Route path="student-dashboard" element={<RequireAuth roles={['student']}><StudentDashboard /></RequireAuth>} />
        <Route path="certificate" element={<Certificate />} />
        <Route path="command-center" element={<RequireAuth roles={['admin', 'teacher', 'proctor']}><CommandCenter /></RequireAuth>} />
        <Route path="demo-center" element={<RequireAuth roles={['admin', 'teacher', 'proctor']}><DemoCenter /></RequireAuth>} />
        <Route path="mobile-preview" element={<RequireAuth roles={['admin']}><MobilePreview /></RequireAuth>} />
        <Route path="live-classroom" element={<LiveClassroom />} />
        <Route path="survey" element={<Survey />} />
        <Route path="forum" element={<Forum />} />
        <Route path="knowledge-graph" element={<KnowledgeGraph />} />
        <Route path="speaking-test" element={<RequireAuth roles={['student']}><SpeakingTest /></RequireAuth>} />
        <Route path="learning-loop" element={<LearningLoop />} />
        <Route path="wrong-book" element={<RequireAuth roles={['student']}><WrongBook /></RequireAuth>} />
        <Route path="exam-analysis" element={<RequireAuth roles={['teacher', 'admin']}><ExamAnalysis /></RequireAuth>} />
        <Route path="teacher-dashboard" element={<RequireAuth roles={['teacher', 'admin']}><TeacherDashboard /></RequireAuth>} />
        <Route path="course-objective" element={<RequireAuth roles={['teacher', 'admin']}><CourseObjectiveAnalysis /></RequireAuth>} />
        <Route path="ai-grading" element={<RequireAuth roles={['teacher', 'admin']}><AIGrading /></RequireAuth>} />
        <Route path="info-collection" element={<RequireAuth roles={['student']}><InfoCollection /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  function HomeByRole() {
    const u = getStoredUser()
    if (!u) return <Navigate to="/login" replace />
    if (u.role === 'student') return <StudentHome />
    if (u.role === 'teacher') return <TeacherHome />
    if (u.role === 'proctor') return <CommandCenter />
    return <CommandCenter />
  }
}

