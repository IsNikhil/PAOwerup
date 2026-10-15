import sonaResume from '../../../samples/sona_data_analyst_resume.txt?raw'
import marcusResume from '../../../samples/marcus_culinary_resume.txt?raw'
import acmeJob from '../../../samples/job_data_analyst_acme.txt?raw'
import pelicanJob from '../../../samples/job_frontend_engineer.txt?raw'

export interface SamplePair {
  id: string
  name: string
  description: string
  resume: { text: string; filename: string }
  job: { text: string; title: string }
}

export const SAMPLES: SamplePair[] = [
  {
    id: 'strong',
    name: 'Sona – Data Analyst @ Acme',
    description: 'Strong match: CS student with SQL, Python and Tableau',
    resume: { text: sonaResume, filename: 'sona_data_analyst_resume.txt' },
    job: { text: acmeJob, title: 'Data Analyst @ Acme Analytics' },
  },
  {
    id: 'stretch',
    name: 'Sona – Frontend @ Pelican',
    description: 'Stretch role: data background vs. a React/TypeScript job',
    resume: { text: sonaResume, filename: 'sona_data_analyst_resume.txt' },
    job: { text: pelicanJob, title: 'Junior Frontend Engineer @ Pelican Labs' },
  },
  {
    id: 'weak',
    name: 'Marcus – Data Analyst @ Acme',
    description: 'Weak match: kitchen lead applying to a data role',
    resume: { text: marcusResume, filename: 'marcus_culinary_resume.txt' },
    job: { text: acmeJob, title: 'Data Analyst @ Acme Analytics' },
  },
]
