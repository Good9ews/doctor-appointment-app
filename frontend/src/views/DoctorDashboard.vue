<template>
  <div class="doctor-dashboard">

    <!-- DASHBOARD HERO -->
    <section class="dashboard-hero">
      <div>
        <span class="section-eyebrow">DOCTOR DASHBOARD</span>

        <h1>Welcome, {{ userName }}</h1>

        <p>
          Manage your doctor profile and availability from here.
        </p>
      </div>

      <div class="dashboard-icon">
        ♥
      </div>
    </section>

    <main class="dashboard-container">

      <!-- TOP CARDS -->
      <section class="dashboard-grid">

        <div class="dashboard-card">
          <div class="dashboard-card-icon">
            ♙
          </div>

          <div>
            <h2>Doctor Profile</h2>

            <p>
              View and manage your doctor profile information.
            </p>

            <router-link
              v-if="doctorId"
              :to="`/doctors/${doctorId}`"
              class="dashboard-button"
            >
              View Profile
            </router-link>

            <router-link
              v-else
              to="/doctor/profile/setup"
              class="dashboard-button"
            >
              Create Profile
            </router-link>
          </div>
        </div>

        <div class="dashboard-card">
          <div class="dashboard-card-icon">
            ◷
          </div>

          <div>
            <h2>Availability</h2>

            <p>
              Manage the available dates and time slots patients can book.
            </p>

            <button
              class="dashboard-button"
              type="button"
              @click="showAddForm = !showAddForm"
            >
              {{ showAddForm ? 'Close Form' : 'Add Availability' }}
            </button>
          </div>
        </div>

      </section>

      <!-- MESSAGE -->
      <div
        v-if="message"
        class="dashboard-message success"
      >
        {{ message }}
      </div>

      <div
        v-if="errorMessage"
        class="dashboard-message error"
      >
        {{ errorMessage }}
      </div>

      <!-- ADD SINGLE SLOT -->
      <section
        v-if="showAddForm"
        class="availability-form-section"
      >
        <div class="section-heading">
          <div>
            <span class="section-eyebrow">ADD AVAILABILITY</span>

            <h2>
              Create a Time Slot
            </h2>

            <p>
              Add a date and time when patients can book an appointment.
            </p>
          </div>
        </div>

        <form
          class="availability-form"
          @submit.prevent="createAvailability"
        >

          <div class="form-field">
            <label for="availability-date">
              Date
            </label>

            <input
              id="availability-date"
              v-model="form.date"
              type="date"
              required
            />
          </div>

          <div class="form-field">
            <label for="availability-start">
              Start Time
            </label>

            <input
              id="availability-start"
              v-model="form.startTime"
              type="time"
              required
            />
          </div>

          <div class="form-field">
            <label for="availability-end">
              End Time
            </label>

            <input
              id="availability-end"
              v-model="form.endTime"
              type="time"
              required
            />
          </div>

          <button
            type="submit"
            class="dashboard-button"
            :disabled="formLoading || !doctorId"
          >
            {{ formLoading ? 'Creating...' : 'Add Time Slot' }}
          </button>

        </form>
      </section>

      <!-- RECURRING AVAILABILITY -->
      <section class="availability-form-section">

        <div class="section-heading">
          <div>
            <span class="section-eyebrow">
              RECURRING AVAILABILITY
            </span>

            <h2>
              Create Weekly Schedule
            </h2>

            <p>
              Generate availability for selected weekdays within a date range.
            </p>
          </div>
        </div>

        <form
          class="availability-form recurring-form"
          @submit.prevent="createRecurringAvailability"
        >

          <div class="form-field">
            <label for="recurring-start-date">
              Start Date
            </label>

            <input
              id="recurring-start-date"
              v-model="recurringForm.startDate"
              type="date"
              required
            />
          </div>

          <div class="form-field">
            <label for="recurring-end-date">
              End Date
            </label>

            <input
              id="recurring-end-date"
              v-model="recurringForm.endDate"
              type="date"
              required
            />
          </div>

          <div class="form-field form-field-full">
            <label>
              Days of Week
            </label>

            <div class="weekday-grid">

              <label
                v-for="day in weekdays"
                :key="day.value"
                class="weekday-option"
              >
                <input
                  v-model="recurringForm.daysOfWeek"
                  type="checkbox"
                  :value="day.value"
                />

                <span>
                  {{ day.label }}
                </span>
              </label>

            </div>
          </div>

          <div class="form-field">
            <label for="recurring-start-time">
              Start Time
            </label>

            <input
              id="recurring-start-time"
              v-model="recurringForm.startTime"
              type="time"
              required
            />
          </div>

          <div class="form-field">
            <label for="recurring-end-time">
              End Time
            </label>

            <input
              id="recurring-end-time"
              v-model="recurringForm.endTime"
              type="time"
              required
            />
          </div>

          <button
            type="submit"
            class="dashboard-button"
            :disabled="recurringLoading || !doctorId"
          >
            {{
              recurringLoading
                ? 'Creating...'
                : 'Create Weekly Schedule'
            }}
          </button>

        </form>
      </section>

      <!-- YOUR SCHEDULE -->
      <section class="availability-section">

        <div class="section-heading">

          <div>
            <span class="section-eyebrow">
              YOUR SCHEDULE
            </span>

            <h2>
              Availability Slots
            </h2>

            <p>
              These are the appointment slots currently associated with your doctor profile.
            </p>
          </div>

          <button
            class="dashboard-button"
            type="button"
            @click="loadAvailability"
          >
            Refresh
          </button>

        </div>

        <!-- LOADING -->
        <div
          v-if="loading"
          class="dashboard-loading"
        >
          Loading availability...
        </div>

        <!-- EMPTY -->
        <div
          v-else-if="availability.length === 0"
          class="dashboard-empty"
        >
          <div class="empty-icon">
            ◷
          </div>

          <h3>
            No availability yet
          </h3>

          <p>
            Add a time slot or create a weekly schedule.
          </p>
        </div>

        <!-- SLOTS -->
        <div
          v-else
          class="availability-list"
        >

          <div
            v-for="slot in availability"
            :key="slot._id"
            class="availability-card"
          >

            <div>
              <span class="detail-label">
                DATE
              </span>

              <strong>
                {{ formatDate(slot.date) }}
              </strong>
            </div>

            <div>
              <span class="detail-label">
                TIME
              </span>

              <strong>
                {{ slot.startTime }} - {{ slot.endTime }}
              </strong>
            </div>

            <span
              class="slot-status"
              :class="{ booked: slot.isBooked }"
            >
              {{ slot.isBooked ? 'Booked' : 'Available' }}
            </span>

            <div
              v-if="!slot.isBooked"
              class="slot-actions"
            >

              <button
                type="button"
                class="slot-action-button"
                @click="startEdit(slot)"
              >
                Edit
              </button>

              <button
                type="button"
                class="slot-action-button delete"
                @click="deleteSlot(slot)"
              >
                Delete
              </button>

            </div>

          </div>

        </div>

      </section>

      <!-- EDIT SLOT -->
      <section
        v-if="editingSlot"
        class="availability-form-section"
      >

        <div class="section-heading">

          <div>
            <span class="section-eyebrow">
              EDIT AVAILABILITY
            </span>

            <h2>
              Update Time Slot
            </h2>

            <p>
              Change the date or time for this available slot.
            </p>
          </div>

        </div>

        <form
          class="availability-form"
          @submit.prevent="updateSlot"
        >

          <div class="form-field">
            <label>
              Date
            </label>

            <input
              v-model="editForm.date"
              type="date"
              required
            />
          </div>

          <div class="form-field">
            <label>
              Start Time
            </label>

            <input
              v-model="editForm.startTime"
              type="time"
              required
            />
          </div>

          <div class="form-field">
            <label>
              End Time
            </label>

            <input
              v-model="editForm.endTime"
              type="time"
              required
            />
          </div>

          <div class="edit-actions">

            <button
              type="submit"
              class="dashboard-button"
              :disabled="editLoading"
            >
              {{ editLoading ? 'Saving...' : 'Save Changes' }}
            </button>

            <button
              type="button"
              class="secondary-button"
              @click="cancelEdit"
            >
              Cancel
            </button>

          </div>

        </form>

      </section>

    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'

const user = ref(null)
const doctorId = ref(null)

const availability = ref([])

const loading = ref(false)
const formLoading = ref(false)
const recurringLoading = ref(false)
const editLoading = ref(false)

const showAddForm = ref(false)

const message = ref('')
const errorMessage = ref('')

const editingSlot = ref(null)

const form = ref({
  date: '',
  startTime: '',
  endTime: ''
})

const editForm = ref({
  date: '',
  startTime: '',
  endTime: ''
})

const recurringForm = ref({
  startDate: '',
  endDate: '',
  daysOfWeek: [],
  startTime: '',
  endTime: ''
})

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

const userName = computed(() => {
  return user.value?.name || 'Doctor'
})

const clearMessages = () => {
  message.value = ''
  errorMessage.value = ''
}

const loadUser = () => {
  const storedUser = localStorage.getItem('doctex_user')

  if (!storedUser) {
    user.value = null
    return
  }

  try {
    user.value = JSON.parse(storedUser)
  } catch {
    user.value = null
  }
}

const loadDoctor = async () => {
  if (!user.value) return

  try {
    const response = await api.get('/doctors')

    const doctors =
      response.data.data ||
      response.data.doctors ||
      []

    const doctor = doctors.find(
      item =>
        item.user === user.value._id ||
        item.user?._id === user.value._id ||
        item.email === user.value.email
    )

    if (doctor) {
      doctorId.value = doctor._id
    }
  } catch (error) {
    console.error('Unable to load doctor profile:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'Unable to load doctor profile.'
  }
}

const loadAvailability = async () => {
  if (!doctorId.value) return

  clearMessages()

  loading.value = true

  try {
    const response = await api.get(
      `/availability/doctor/${doctorId.value}`
    )

    availability.value =
      response.data.data ||
      response.data.availability ||
      []
  } catch (error) {
    console.error('Unable to load availability:', error)

    availability.value = []

    errorMessage.value =
      error.response?.data?.message ||
      'Unable to load availability.'
  } finally {
    loading.value = false
  }
}

const createAvailability = async () => {
  if (!doctorId.value) return

  clearMessages()

  formLoading.value = true

  try {
    await api.post('/availability', {
      doctor: doctorId.value,
      date: form.value.date,
      startTime: form.value.startTime,
      endTime: form.value.endTime
    })

    message.value = 'Availability created successfully.'

    form.value = {
      date: '',
      startTime: '',
      endTime: ''
    }

    showAddForm.value = false

    await loadAvailability()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to create availability.'
  } finally {
    formLoading.value = false
  }
}

const createRecurringAvailability = async () => {
  if (!doctorId.value) return

  clearMessages()

  if (recurringForm.value.daysOfWeek.length === 0) {
    errorMessage.value =
      'Please select at least one day of the week.'
    return
  }

  recurringLoading.value = true

  try {
    const response = await api.post(
      '/availability/recurring',
      {
        doctor: doctorId.value,
        startDate: recurringForm.value.startDate,
        endDate: recurringForm.value.endDate,
        daysOfWeek: recurringForm.value.daysOfWeek,
        startTime: recurringForm.value.startTime,
        endTime: recurringForm.value.endTime
      }
    )

    message.value =
      response.data.message ||
      'Recurring availability created successfully.'

    recurringForm.value = {
      startDate: '',
      endDate: '',
      daysOfWeek: [],
      startTime: '',
      endTime: ''
    }

    await loadAvailability()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to create recurring availability.'
  } finally {
    recurringLoading.value = false
  }
}

const startEdit = (slot) => {
  if (slot.isBooked) return

  clearMessages()

  editingSlot.value = slot

  editForm.value = {
    date: formatDateForInput(slot.date),
    startTime: slot.startTime,
    endTime: slot.endTime
  }

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth'
  })
}

const cancelEdit = () => {
  editingSlot.value = null

  editForm.value = {
    date: '',
    startTime: '',
    endTime: ''
  }
}

const updateSlot = async () => {
  if (!editingSlot.value) return

  clearMessages()

  editLoading.value = true

  try {
    await api.put(
      `/availability/${editingSlot.value._id}`,
      {
        date: editForm.value.date,
        startTime: editForm.value.startTime,
        endTime: editForm.value.endTime
      }
    )

    message.value = 'Availability updated successfully.'

    cancelEdit()

    await loadAvailability()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to update availability.'
  } finally {
    editLoading.value = false
  }
}

const deleteSlot = async (slot) => {
  if (slot.isBooked) return

  const confirmed = window.confirm(
    'Are you sure you want to delete this availability slot?'
  )

  if (!confirmed) return

  clearMessages()

  try {
    await api.delete(
      `/availability/${slot._id}`
    )

    message.value = 'Availability deleted successfully.'

    await loadAvailability()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to delete availability.'
  }
}

const formatDateForInput = (date) => {
  if (!date) return ''

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(
    parsedDate.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    parsedDate.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const formatDate = (date) => {
  if (!date) return '—'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return date
  }

  return parsedDate.toLocaleDateString(
    'en-US',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  )
}

onMounted(async () => {
  loadUser()

  await loadDoctor()

  await loadAvailability()
})
</script>