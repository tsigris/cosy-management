'use client'

import { useState, Suspense } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Mail } from 'lucide-react'

const getEmailRedirectUrl = () => {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL

  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/login`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/login`
  }

  return '/login'
}

function RegisterForm() {

  const supabase = getSupabase()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const loginHref = '/login'


  /* ---------------- RESEND EMAIL ---------------- */

  const handleResendConfirmationEmail = async () => {

    if (!email) {
      toast.error('Συμπλήρωσε πρώτα το email.')
      return
    }

    try {

      setResendLoading(true)

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: getEmailRedirectUrl()
        }
      })

      if (error) throw error

      toast.success('Στάλθηκε νέο email επιβεβαίωσης.')

    } catch (e: any) {

      toast.error(e.message || 'Σφάλμα επαναποστολής')

    } finally {

      setResendLoading(false)

    }

  }


  /* ---------------- SIGNUP ---------------- */

  const handleSignUp = async (e: React.FormEvent) => {

    e.preventDefault()

    if (!email || password.length < 6) {

      toast.error('Email και password τουλάχιστον 6 χαρακτήρες.')
      return

    }

    try {

      setLoading(true)

      /* -------- CREATE AUTH USER -------- */

      const {
        data: authData,
        error: signUpError
      } = await supabase.auth.signUp({

        email: email.trim(),

        password: password, // ⚠️ IMPORTANT: no trim

        options: {

          emailRedirectTo: getEmailRedirectUrl(),

          data: {
            username: username || email.split('@')[0]
          }

        }

      })

      if (signUpError) throw signUpError

      const user = authData.user

      if (!user) throw new Error('Signup failed')


      /* -------- CHECK EMAIL CONFIRM -------- */

      const isEmailConfirmed =
        !!user.email_confirmed_at ||
        !!(user as any).confirmed_at


      let session = authData.session


      /* -------- AUTO LOGIN IF NO SESSION -------- */

      if (!session && isEmailConfirmed) {

        const loginRes =
          await supabase.auth.signInWithPassword({

            email: email.trim(),
            password: password

          })

        if (loginRes.error)
          throw loginRes.error

        session = loginRes.data.session

      }


      /* -------- EMAIL CONFIRM REQUIRED -------- */

      if (!session && !isEmailConfirmed) {

        setEmailConfirmationPending(true)

        toast.success(
          'Η εγγραφή έγινε. Ελέγξτε το email για επιβεβαίωση.'
        )

        return

      }


      /* -------- CREATE STORE -------- */

      const {
        data: store,
        error: storeError
      } = await supabase
        .from('stores')
        .insert({

          name:
            `ΚΑΤΑΣΤΗΜΑ ${
              username?.toUpperCase() ||
              email.split('@')[0].toUpperCase()
            }`,

          owner_id: user.id

        })
        .select()
        .single()

      if (storeError) throw storeError

      const storeId = store.id


      /* -------- STORE ACCESS -------- */

      await supabase
        .from('store_access')
        .insert({

          user_id: user.id,
          store_id: storeId,
          role: 'admin'

        })


      /* -------- PROFILE UPDATE -------- */

      await supabase
        .from('profiles')
        .update({

          store_id: storeId,
          role: 'admin'

        })
        .eq('id', user.id)


      /* -------- DEFAULT ASSETS -------- */

      await supabase
        .from('fixed_assets')
        .insert([
          {
            name: 'ΕΝΟΙΚΙΟ',
            store_id: storeId
          },
          {
            name: 'ΛΟΓΙΣΤΗΣ',
            store_id: storeId
          },
          {
            name: 'ΔΕΗ / ΡΕΥΜΑ',
            store_id: storeId
          }
        ])


      /* -------- SUCCESS -------- */

      toast.success('Η εγγραφή ολοκληρώθηκε!')


      localStorage.setItem(
        'active_store_id',
        storeId
      )


      router.push(`/?store=${storeId}`)

      router.refresh()


    } catch (e: any) {

      console.error(e)

      toast.error(
        e.message || 'Signup error'
      )

    } finally {

      setLoading(false)

    }

  }


  /* ---------------- UI ---------------- */

  return (

    <div style={cardStyle}>

      <Toaster position="top-center" richColors />

      <div style={headerStyle}>

        <h1 style={brandStyle}>
          COSY APP
        </h1>

        <div style={dividerStyle}/>

        <p style={instructionStyle}>
          ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ
        </p>

      </div>


      {emailConfirmationPending ? (

        <div style={confirmationWrapStyle}>

          <Mail size={28}/>

          <p style={confirmationTextStyle}>
            Επιβεβαιώστε το email σας.
          </p>

          <button
            onClick={handleResendConfirmationEmail}
            disabled={resendLoading}
            style={resendBtnStyle}
          >
            ΕΠΑΝΑΠΟΣΤΟΛΗ EMAIL
          </button>

          <Link
            href="/login"
            style={confirmLoginBtnStyle}
          >
            LOGIN
          </Link>

        </div>

      ) : (

        <form
          onSubmit={handleSignUp}
          style={formStyle}
        >

          <input
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="Username"
            style={inputStyle}
          />

          <input
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
            required
          />

          <button
            disabled={loading}
            style={submitBtnStyle}
          >
            {loading
              ? 'Creating...'
              : 'Create Account'}
          </button>

        </form>

      )}

      <div style={footerStyle}>
        <Link href="/login">
          ← LOGIN
        </Link>
      </div>

    </div>

  )

}


/* ---------------- PAGE ---------------- */

export default function RegisterPage() {

  return (

    <main style={containerStyle}>

      <Suspense fallback={<div>Loading...</div>}>

        <RegisterForm/>

      </Suspense>

    </main>

  )

}


/* ---------------- STYLES ---------------- */

const containerStyle:any={
  minHeight:'100vh',
  display:'flex',
  alignItems:'center',
  justifyContent:'center'
}

const cardStyle:any={
  width:400,
  padding:30,
  borderRadius:20,
  background:'#fff'
}

const headerStyle:any={textAlign:'center'}

const brandStyle:any={fontSize:24,fontWeight:900}

const dividerStyle:any={
  height:4,
  width:40,
  background:'#6366f1',
  margin:'10px auto'
}

const instructionStyle:any={
  fontSize:12,
  fontWeight:700
}

const formStyle:any={
  display:'flex',
  flexDirection:'column',
  gap:15
}

const inputStyle:any={
  padding:12,
  borderRadius:10,
  border:'1px solid #ccc'
}

const submitBtnStyle:any={
  padding:14,
  borderRadius:10,
  background:'#0f172a',
  color:'#fff',
  border:'none',
  fontWeight:800
}

const confirmationWrapStyle:any={
  textAlign:'center'
}

const confirmationTextStyle:any={
  marginTop:10
}

const resendBtnStyle:any={
  marginTop:10,
  padding:10
}

const confirmLoginBtnStyle:any={
  display:'block',
  marginTop:10
}

const footerStyle:any={
  marginTop:20,
  textAlign:'center'
}