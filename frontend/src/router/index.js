import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Doctors from '../views/Doctors.vue'
import DoctorProfile from '../views/DoctorProfile.vue'
import BookAppointment from '../views/BookAppointment.vue'
import Appointments from '../views/Appointments.vue'
import DoctorDashboard from '../views/DoctorDashboard.vue'
import DoctorProfileSetup from '../views/DoctorProfileSetup.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/doctors',
    name: 'Doctors',
    component: Doctors
  },
  {
    path: '/doctors/:id',
    name: 'DoctorProfile',
    component: DoctorProfile
  },
  {
    path: '/book-appointment',
    name: 'BookAppointment',
    component: BookAppointment
  },
  {
    path: '/appointments',
    name: 'Appointments',
    component: Appointments
  },
  {
    path: '/doctor/dashboard',
    name: 'DoctorDashboard',
    component: DoctorDashboard,
    meta: {
      requiresDoctor: true
    }
  },
  {
    path: '/doctor/profile/setup',
    name: 'DoctorProfileSetup',
    component: DoctorProfileSetup,
    meta: {
      requiresDoctor: true
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (!to.meta.requiresDoctor) {
    return true
  }

  const storedUser = localStorage.getItem('doctex_user')

  if (!storedUser) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  try {
    const user = JSON.parse(storedUser)

    if (user.role !== 'doctor') {
      return '/doctors'
    }

    return true
  } catch {
    localStorage.removeItem('doctex_user')
    localStorage.removeItem('doctex_token')

    return {
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    }
  }
})

export default router