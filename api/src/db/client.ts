import postgres from 'postgres'
import { DB_URL } from '../lib/config.js'

const sql = postgres(DB_URL)

export default sql
