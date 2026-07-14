-- Voz peruana: elimina el voseo que había quedado en el CONTENIDO (data) de las
-- experiencias y pasos. Reemplazos exactos de lo detectado (Vení→Ven, Seguí→Sigue).

update experiences
  set henry_tip = 'Ven con hambre y zapatillas cómodas.'
  where henry_tip = 'Vení con hambre y zapatillas cómodas.';

update steps
  set proposal = 'Ven sin apuro, esto se disfruta caminando.'
  where proposal = 'Vení sin apuro, esto se disfruta caminando.';

update steps
  set proposal = 'Arrancamos por la de siempre. Ven con hambre.'
  where proposal = 'Arrancamos por la de siempre. Vení con hambre.';

update steps
  set title = 'Sigue conmigo'
  where title = 'Seguí conmigo';

update steps
  set paywall_message = 'Sigue el recorrido completo conmigo.'
  where paywall_message = 'Seguí el recorrido completo conmigo.';
