
import { NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

/**
 * Endpoint para recibir Postbacks de Redes CPA (Ej: Cpamerchant)
 * Estructura esperada del Payload (POST o GET):
 * {
 *   "conversion_id": "TRANS123",
 *   "sub_id": "ABC1234",
 *   "offer_id": "500",
 *   "status": "approved",
 *   "payout": 5.50 (opcional)
 * }
 */

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { conversion_id, sub_id, offer_id, status } = payload;

    if (!conversion_id || !sub_id || !offer_id) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    // 1. Verificar si la conversión ya existe
    const autoLeadsRef = collection(db, 'leads_automated');
    const existingQuery = query(autoLeadsRef, where('conversionIdCpa', '==', conversion_id));
    const existingSnap = await getDocs(existingQuery);

    if (!existingSnap.empty) {
      // Caso: Actualización de estado
      const leadDoc = existingSnap.docs[0];
      await updateDoc(doc(db, 'leads_automated', leadDoc.id), {
        status: status || 'pending',
        updatedAt: serverTimestamp()
      });
      return NextResponse.json({ success: true, message: 'Estado actualizado' });
    }

    // 2. Nueva Conversión: Atribución de Trabajador y Campaña
    // Buscar Publisher por SubID
    const publishersRef = collection(db, 'publishers');
    const pubQuery = query(publishersRef, where('subId', '==', sub_id));
    const pubSnap = await getDocs(pubQuery);

    if (pubSnap.empty) {
      return NextResponse.json({ error: 'SubID no encontrado en el equipo' }, { status: 404 });
    }
    const publisher = pubSnap.docs[0].data();

    // Buscar Oferta por Network ID
    const offersRef = collection(db, 'offers');
    const offerQuery = query(offersRef, where('networkOfferId', '==', String(offer_id)));
    const offerSnap = await getDocs(offerQuery);

    if (offerSnap.empty) {
       return NextResponse.json({ error: 'Campaña no encontrada en el catálogo' }, { status: 404 });
    }
    const offer = offerSnap.docs[0].data();

    // 3. Registrar Lead Automatizado
    const leadData = {
      conversionIdCpa: conversion_id,
      publisherId: pubSnap.docs[0].id,
      publisherName: `${publisher.firstName} ${publisher.lastName}`,
      subId: sub_id,
      offerId: offerSnap.docs[0].id,
      offerName: offer.name,
      agency: offer.agency || 'CPA Network',
      amountUSD: payload.payout || offer.paymentAmount || 0,
      status: status || 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(autoLeadsRef, leadData);

    return NextResponse.json({ success: true, message: 'Conversión registrada con éxito' });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// Soporte para redes que solo envían GET Postbacks
export async function GET(request: Request) {
  // Simplemente redirigir la lógica a un manejador común o procesar searchParams
  const { searchParams } = new URL(request.url);
  const conversion_id = searchParams.get('conversion_id');
  const sub_id = searchParams.get('sub_id');
  const offer_id = searchParams.get('offer_id');
  const status = searchParams.get('status');

  // Convertimos a objeto y llamamos a la lógica si es necesario
  // (Por simplicidad en este MVP, asumimos que usan POST)
  return NextResponse.json({ message: 'GET Webhook received, please use POST for full attribution logic.' });
}
