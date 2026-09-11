-- ============================================================================
-- 158 - Sueldos semanales desde «NOMINA ACTUAL.xlsx» (entregado por el dueno).
--
-- QUE CARGA: el sueldo SEMANAL de 93 personas, mas un 0 explicito. Nada mas: no crea
-- usuarios, no cambia puestos ni jerarquia.
--
-- LA BASE ES SEMANAL, Y NO ES UNA SUPOSICION. La hoja «NOMINA JUN» del mismo archivo tiene
-- cuatro columnas -«Nomina del 03, 10, 17 y 24 de Junio»- y una quinta de TOTAL MENSUAL que es
-- su suma (6800 x 4 = 27200). La hoja «HOTEL» encabeza «DEL 07 AL 12 DE SEPTIEMBRE». Los
-- importes son por semana, que es justo lo que espera `sueldo_semanal` (mig. 156). Cargar aqui
-- un importe mensual habria multiplicado por cuatro la nomina de toda la plantilla.
--
-- COMO SE EMPAREJARON LOS NOMBRES: normalizando (sin acentos, sin prefijos DRA/DR/RECEP/LIC) y
-- exigiendo coincidencia exacta o muy alta. Las 7 que no casaban por typo o nombre corto se
-- revisaron UNA A UNA con el dueno y se escribieron a mano en el generador -el apply no adivina:
--   Cynthia/Cinthya Ugalde · Angello/Angelo Izugar · Wendy Jailin Alonso Motas -> Wendy Alonso
--   Karla Guzman -> Karla Guzman Sanchez · Samanta -> Samantha Perez Carreno
--   «Mariana A guilar» -> Mariana Aguilar · Jessica Montoya -> Jesica Guadalupe Montoya Marquez
--
-- LO QUE NO SE TOCA: las personas de Pulse que no traen importe en el archivo quedan en NULL
-- («sin capturar»), que la pantalla distingue de cero y muestra como «Falta el sueldo». Y las
-- filas del Excel sin nadie en Pulse no se importan: no se crean usuarios desde una nomina.
--
-- MARIA COVARRUVIAS TORRES traia «G83» en la casilla del importe. Decision del dueno: su pago
-- corre por otra empresa, asi que aqui va 0 explicito.
--
-- Suma semanal cargada: 257,650.00
-- ============================================================================

begin;

update public.usuarios set sueldo_semanal = 2700.00 where id = '1683612e-c47e-45f9-af8b-cdf634826cf4';  -- ALEJANDRA RALIS DE LOS SANTOS  [NOMINA MCDENTAL f50: DRA. ALEJANDRA RALIS DE LOS SANTOS]
update public.usuarios set sueldo_semanal = 1000.00 where id = '4bf68118-703c-4ebf-8a84-a80900c54821';  -- ALEX EDUARDO CRUZ MUÑIZ  [ADMINISTRATIVO f27: ALEX EDUARDO CRUZ MUÑIZ (TI)]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'ac62af68-4fff-40db-8112-c257c569d93d';  -- ALEXIS ALAN RAFAEL CASTAN  [ADMINISTRATIVO f17: ALAN ALEXIS RAFAEL CASTAN]
update public.usuarios set sueldo_semanal = 2000.00 where id = 'fff31b54-81d2-4353-b1df-fc6b30350ec2';  -- ALFREDO EDUARDO BURGOS REYES  [ADMINISTRATIVO f18: ALFREDO EDUARDO BURGOS REYES]
update public.usuarios set sueldo_semanal = 3000.00 where id = '6c70f373-e407-4d51-8572-4092dbc1cf68';  -- ALIA MARICRUZ LOPEZ GUZMAN  [NOMINA MCDENTAL f148: RECEP ALIA MARICRUZ LOPEZ GUZMAN]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'f28a883a-5d90-47df-92ba-f9205dcff7f2';  -- ALICIA DANAEE RAMIREZ RUIZ  [NOMINA MCDENTAL f33: DRA. ALICIA DANAEE RAMIREZ RUIZ]
update public.usuarios set sueldo_semanal = 2250.00 where id = 'd667b32c-5a25-4f97-9081-2431b40c4684';  -- ANA GABRIELA DE LA O HILARIO  [NOMINA MCDENTAL f107: RECEP  ANA GABRIELA DE LA O HILARIO]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'f319b8af-2416-4289-aa66-3afbb9fea5ff';  -- ANA GORETTY SALAS  [ADMINISTRATIVO f20: LIC. ANA GORETTY SALAS]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'ac36ced0-045c-465c-927e-4475090f1737';  -- ANA KAREN MEZA GONZALEZ  [ADMINISTRATIVO f8: ANA KAREN MEZA GONZALEZ]
update public.usuarios set sueldo_semanal = 3300.00 where id = '2919eeba-385d-46bf-b8ac-3afd4fd76ee4';  -- ANA MARLEN RODRIGUEZ FLORES  [NOMINA MCDENTAL f130: RECEP. ANA MARLEN RODRIGUEZ FLORES]
update public.usuarios set sueldo_semanal = 2500.00 where id = '0fb19116-d10a-4949-b320-2e1393a2537d';  -- ANA ROSA GOMEZ PEREZ  [ADMINISTRATIVO f14: ANA ROSA GOMEZ PEREZ]
update public.usuarios set sueldo_semanal = 3000.00 where id = '273ad87d-38da-476c-8c1d-5c3909e5cee3';  -- ANAIS GISSEL RODRIGUEZ PEREZ  [NOMINA MCDENTAL f16: DRA. ANAIS GISSEL RODRIGUEZ PEREZ]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'f0264731-b331-4268-a5f1-9f2df6643773';  -- ANDREA ALDANA MEDINA  [NOMINA MCDENTAL f11: RECEP. ANDREA ALDANA MEDINA]
update public.usuarios set sueldo_semanal = 2700.00 where id = '86ee6354-4b34-4ac2-b1ca-6015c01c2f35';  -- ANGELO ARTURO IZUGAR VICENCIO  [NOMINA MCDENTAL f9: DR. ANGELLO ARTURO IZUGAR VICENCIO]
update public.usuarios set sueldo_semanal = 2800.00 where id = '4c53f0c3-a90e-4219-b052-a1cd2c1a7721';  -- ARIADNA LISELI VILLEGAS  [NOMINA MCDENTAL f39: DRA ARIADNA LISELI VILLEGAS]
update public.usuarios set sueldo_semanal = 2800.00 where id = '41d7e11c-6af0-4c95-a42c-13e81230e651';  -- ARIEL ISAI GONZALEZ AGUILAR  [NOMINA MCDENTAL f45: DR. ARIEL ISAI GONZALEZ AGUILAR]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'b2709e27-efe1-4aad-82fa-4080ccd43c3a';  -- ARMANDO DAMIAN CASTILLO CASTRO  [NOMINA MCDENTAL f82: DR. ARMANDO DAMIAN CASTILLO CASTRO]
update public.usuarios set sueldo_semanal = 3500.00 where id = '5cea2db9-0162-4b9b-8840-eb74fdcab307';  -- ARTURO DANIEL ACEVEDO DAVALOS  [NOMINA MCDENTAL f65: DR. ARTURO DANIEL ACEVEDO DAVALOS]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'f906340a-a8b7-4436-9a8b-a238dee13465';  -- BRENDA FERNANDA OLVERA DIAZ  [NOMINA MCDENTAL f19: RECEP. BRENDA FERNANDA OLVERA DIAZ]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'b6fe712e-e25c-4130-8a4d-6e8c6eaa0c94';  -- BRENDA LIZETH ANASTASIO CASTILLO  [NOMINA MCDENTAL f153: RECEP. BRENDA LIZETH CASTILLO ANASTASIO]
update public.usuarios set sueldo_semanal = 2350.00 where id = '5eb86e3a-24ba-46e2-8a8d-40ad3d27b18e';  -- CINTHYA GUADALUPE UGALDE PEDRAZA  [NOMINA MCDENTAL f5: RECEP CYNTHIA GUADALUPE UGALDE PEDRAZA]
update public.usuarios set sueldo_semanal = 3500.00 where id = '321f49c9-670d-4fb7-9fe7-4d87f799c541';  -- CLARA CRISTINA MARISCAL DELGADO  [NOMINA MCDENTAL f64: DRA. CLARA CRISTINA MARISCAL DELGADO]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'b05cf9a3-eecd-4671-a94d-6ba24220eff8';  -- CONRADO GALVAN OCHOA  [NOMINA MCDENTAL f27: DR. CONRADO GALVAN OCHOA]
update public.usuarios set sueldo_semanal = 4500.00 where id = 'dd31d98c-b67e-407b-a56c-7f0aea2448c1';  -- CYNTHIA IDALIA VILLAREAL PÉREZ  [NOMINA MCDENTAL f131: DRA. CYNTHIA IDALIA VILLAREAL PÉREZ]
update public.usuarios set sueldo_semanal = 3000.00 where id = '73767461-b456-4be5-bb86-aa269daaa4cb';  -- CYNTIA ELIZABETH CASTELLANOS MUÑOS  [NOMINA MCDENTAL f152: DRA. CYNTIA ELIZABETH CASTELLANOS MUÑOS]
update public.usuarios set sueldo_semanal = 3500.00 where id = '7a75e098-4b19-459c-9356-fd8854512b50';  -- DANIA LIMÓN  [NOMINA MCDENTAL f100: DRA, DANIA LIMÓN]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'd92c7a83-43b5-4c32-a60c-fdb732ff1aa2';  -- DANIELA RODRIGUEZ HERNANDEZ  [NOMINA MCDENTAL f114: DRA. DANIELA RODRIGUEZ HERNANDEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '37a3c458-556d-468c-9152-1a2f080cdb3a';  -- DANNA ESMERALDA SANTOS MARTINEZ  [NOMINA MCDENTAL f12: DRA DANNA ESMERALDA SANTOS MARTINEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '29776e90-fd4f-41fc-8074-4b21730ca26e';  -- DARVIN MENDEZ LOPEZ  [NOMINA MCDENTAL f108: DR. DARVIN MENDEZ LOPEZ]
update public.usuarios set sueldo_semanal = 3000.00 where id = '4a13e631-efcd-4b29-989a-25fc14b31a9d';  -- DEISY YERANDIL MARTINEZ CORDOVA  [NOMINA MCDENTAL f81: DRA.DEISY YERANDIL MARTINEZ CORDOVA]
update public.usuarios set sueldo_semanal = 2350.00 where id = '69988849-c07b-4669-840b-02d23d58aec4';  -- DULCE GUADALUPE DEL ANGEL TREJO  [NOMINA MCDENTAL f125: RECEP. DULCE GUADALUPE DEL ANGEL TREJO]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'cde21f6a-511f-48e9-b74f-c2f9066c118f';  -- ELISA HASHIRA LEOS LARA  [NOMINA MCDENTAL f3: DRA ELISA HASHIRA LEOS LARA]
update public.usuarios set sueldo_semanal = 2700.00 where id = '80b5eef2-b88f-4a38-8287-260a8931c951';  -- ELIZABETH MARTINEZ FERRETIZ  [ADMINISTRATIVO f10: ELIZABETH MARTINEZ FERRETIZ]
update public.usuarios set sueldo_semanal = 1000.00 where id = '106cff6e-ada2-4120-b233-dc8bad7c8c13';  -- ERICK JOSEPH TORRES SUAREZ  [ADMINISTRATIVO f25: ERICK JOSEPH TORRES SUAREZ (TI)]
update public.usuarios set sueldo_semanal = 1400.00 where id = '9a6bcf85-be37-4d02-b24c-767ed15eff42';  -- ESTEFANIA GONZALEZ CALLES  [ADMINISTRATIVO f24: ESTEFANIA GONZALEZ CALLES (marketing)]
update public.usuarios set sueldo_semanal = 3000.00 where id = '37c6dff2-ad91-43f8-80b0-fcd4d41e284a';  -- FABIOLA BELEN MARIANO  [NOMINA MCDENTAL f147: DRA FABIOLA BELEN MARIANO]
update public.usuarios set sueldo_semanal = 3500.00 where id = 'd5c2c52b-e487-4ecf-ae84-bfab0be6814e';  -- FERNANDA MARES  [NOMINA MCDENTAL f142: DRA. FERNANDA MARES]
update public.usuarios set sueldo_semanal = 2500.00 where id = '5c718842-3353-4a74-95b9-6ab6eac0c4c7';  -- FRIDA VIRIDIANA MOGOLLON TELLEZ  [ADMINISTRATIVO f19: FRIDA VIRIDIANA MOGOLLON TELLEZ]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'f0241269-29e6-4ab1-a14f-2024985b3555';  -- GABRIELA ELIZABETH MENDOZA GONZALEZ  [NOMINA MCDENTAL f141: RECEP GABRIELA ELIZABETH MENDOZA GONZALEZ]
update public.usuarios set sueldo_semanal = 2800.00 where id = 'a3b6323b-598a-4135-be5b-e5b695fc305b';  -- GEORGINA SANCHEZ SILVA  [ADMINISTRATIVO f15: MINERVA GEORGINA SANCHEZ SILVA]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'b2001b7d-b8c4-40dc-8c8a-53951e34a4e3';  -- GLORIA IVONE GARCIA CRUZ  [NOMINA MCDENTAL f124: DRA .GLORIA IVONE GARCIA CRUZ]
update public.usuarios set sueldo_semanal = 2800.00 where id = '8ee02ce3-0488-4dcb-b364-111f4bf42cd3';  -- HANIA TORRES PEÑA  [NOMINA MCDENTAL f38: DRA HANIA TORRES PEÑA]
update public.usuarios set sueldo_semanal = 3200.00 where id = '644f4fe0-37bc-4804-8d25-023d82812e1d';  -- HIDALID PEREZ ORTIZ  [NOMINA MCDENTAL f94: DRA. HIDALID PEREZ ORTIZ]
update public.usuarios set sueldo_semanal = 3300.00 where id = '9258499a-51a0-4082-9ca6-fe6da88f4284';  -- HILDA YAQUELINE DE JESUS ZAVALA  [NOMINA MCDENTAL f89: RECP HILDA YAQUELINE DE JESUS ZAVALA]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'caa10411-27eb-4014-a679-a9516e1dc23d';  -- JESICA GUADALUPE MONTOYA MARQUEZ  [NOMINA MCDENTAL f26: RECEP. JESSICA MONTOYA]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'c5cd5bb3-b107-4f45-9b56-de440fca8e89';  -- JESUS ARMANDO BAUTISTA DEL ANGEL  [ADMINISTRATIVO f11: JESUS ARMANDO BAUTISTA DEL ANGEL]
update public.usuarios set sueldo_semanal = 4500.00 where id = 'a23b44e5-64af-4061-8e92-31014c773213';  -- JOSECARLO TREJO  [NOMINA MCDENTAL f90: DR. JOSECARLO TREJO]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'd0b8aecf-5d9b-4c61-ba21-f364de92c663';  -- JUANA GARAY COVARRUBIAS  [NOMINA MCDENTAL f21: DRA JUANA GARAY COVARRUBIAS]
update public.usuarios set sueldo_semanal = 3500.00 where id = '67f221ef-6bee-4dd0-98cf-393fcad343e1';  -- JULIO CESAR MARTINEZ FLORES  [ADMINISTRATIVO f23: JULIO CESAR MARTINEZ FLORES]
update public.usuarios set sueldo_semanal = 3200.00 where id = 'c153378d-45fe-4124-abc4-6ae1319e143b';  -- KAREN SANTIAGO MARTINEZ  [NOMINA MCDENTAL f137: DRA. KAREN MARLEN SANTIAGO MARTINEZ]
update public.usuarios set sueldo_semanal = 2350.00 where id = '0f2af36d-f78f-4819-baa8-047dae439bdf';  -- KARLA GUZMAN SANCHEZ  [NOMINA MCDENTAL f103: RECEP. KARLA GUZMAN]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'f178f0cf-b9ca-4edd-87f1-8230a1d470cf';  -- KEVIN ALEXIS HOPÓLITO GARCÍA  [NOMINA MCDENTAL f109: DR. KEVIN ALEXIS HOPÓLITO GARCÍA]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'c9cbcb88-c392-403c-b9cc-c7bc6bb121f0';  -- LETICIA HERNANDEZ HERNANDEZ  [NOMINA MCDENTAL f113: RECEP. LETICIA HERNANDEZ HERNANDEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '4f294260-75d5-45d6-ac62-e70ee322c133';  -- MARIA DEL ROSARIO LOZANO ARADILLAS  [NOMINA MCDENTAL f51: DRA. MARIA DEL ROSARIO LOZANO ARADILLAS]
update public.usuarios set sueldo_semanal = 3800.00 where id = 'a528a673-b996-4942-b6e8-7d07655f30b5';  -- MARIA FERNANDA RAMOS LOPEZ  [NOMINA MCDENTAL f87: DRA. MARIA FERNANDA RAMOS LOPEZ]
update public.usuarios set sueldo_semanal = 3000.00 where id = '1ad1ab46-7b4a-40a1-beca-e0065b3f74f1';  -- MARIA GUADALUPE TRETO MAYA  [NOMINA MCDENTAL f31: DRA. MARIA GUADALUPE TRETO MAYA]
update public.usuarios set sueldo_semanal = 2350.00 where id = '597d79d7-780b-44e1-aca4-ec1390fe2332';  -- MARIA ISABEL COLLINS ATZIN  [NOMINA MCDENTAL f52: RECEP MARIA ISABEL COLLINS ATZIN]
update public.usuarios set sueldo_semanal = 2350.00 where id = '0de1fd25-2772-487a-9297-e664c51e4949';  -- MARIA JOSE ORTEGA VAZQUEZ  [NOMINA MCDENTAL f46: RECEP MARIA JOSE ORTEGA VAZQUEZ]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'bbccf807-672d-4e0e-9e2b-9a3c2917dbd5';  -- MARIANA AGUILAR LOPEZ  [HOTEL f8: Mariana A guilar Lopez]
update public.usuarios set sueldo_semanal = 2000.00 where id = '6526125a-44e5-4c2d-a8f2-63466c21e768';  -- MARICRUZ IZAGUIRRE OLLERVIDES  [ADMINISTRATIVO f21: MARICRUZ IZAGUIRRE OLLERVIDES]
update public.usuarios set sueldo_semanal = 2350.00 where id = '3603ee5e-e44d-4ebd-8011-29db911432a3';  -- MARTHA ORTIZ MARTINEZ  [NOMINA MCDENTAL f95: RECEP. MARTHA ORTIZ MARTINEZ]
update public.usuarios set sueldo_semanal = 3000.00 where id = '46f31ef2-7d2a-4d33-b54a-f1ddd7cbe280';  -- MELISA TAVERA GOMEZ  [NOMINA MCDENTAL f96: DRA. MELISA TAVERA GOMEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'c8ac9aa5-63a4-40c0-8b97-125abfe3ed2a';  -- MERIE JULIANE PEREZ GUZMAN  [NOMINA MCDENTAL f34: DRA. MERIE PEREZ GUZMAN]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'b9cc5efb-0911-456d-8b09-7837bfa91223';  -- MICHEL BASURCO MENDOZA  [NOMINA MCDENTAL f120: RECEP. MICHEL BASURCO MENDOZA]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'd4f4315e-826e-4f5e-84b8-81dbc53e3ca1';  -- MIREYA HERNANDEZ FLORES  [NOMINA MCDENTAL f146: DRA MIREYA HERNANDEZ FLORES]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'cb4e1324-d807-407e-9f00-c67c6bde0ead';  -- MONICA RODRIGUEZ MARTINEZ  [NOMINA MCDENTAL f126: DRA MONICA RODRIGUEZ MARTINEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '7e47280b-cc61-4895-8c02-8bfd44236ebd';  -- NINIBE ARENAS TOLENTINO  [NOMINA MCDENTAL f56: DRA. NINIBE ARENAS TOLENTINO]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'bba5ff33-8b55-4877-9e3e-b7da697e7079';  -- NOEMI TAMAR HERNANDEZ REYES  [ADMINISTRATIVO f9: NOEMI TAMAR HERNANDEZ REYES]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'ebb6e60b-0cf9-41f1-932a-32c89bbc67f9';  -- NORMA LETICIA LOPEZ CARRILLO  [NOMINA MCDENTAL f75: RECEP. NORMA LETICIA  LOPEZ CARRILLO]
update public.usuarios set sueldo_semanal = 2800.00 where id = 'fd03212c-1d6f-46ed-a399-5bb96631a49f';  -- PAOLA DELGADO GARCÍA  [NOMINA MCDENTAL f63: RECEP. PAOLA DELGADO GARCÍA]
update public.usuarios set sueldo_semanal = 2350.00 where id = '2d80f373-2a3d-4aef-9670-8276f36e25c9';  -- PAOLA ELIZETH MEZA CASTILLO  [NOMINA MCDENTAL f83: RECP. PAOLA ELIZETH MEZA CASTILLO]
update public.usuarios set sueldo_semanal = 2700.00 where id = '6d6b3f54-e472-4c5f-b510-5334c6406e82';  -- REBECA CORTEZ PEREZ  [NOMINA MCDENTAL f58: DRA. REBECA CORTEZ PEREZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '80102d99-c2f9-47f7-848c-5b3df9e9b84d';  -- RENATA MARTINEZ MORENO  [NOMINA MCDENTAL f77: DRA. RENATA MARTINEZ MORENO]
update public.usuarios set sueldo_semanal = 4500.00 where id = 'c9990943-3c37-4e3c-a770-2fa51584f41c';  -- REY DAVID MEDINA SANCHEZ  [NOMINA MCDENTAL f88: DR. REY DAVID MEDINA SANCHEZ]
update public.usuarios set sueldo_semanal = 3500.00 where id = 'f926e1b2-3e33-47e7-bad8-f0180467cac2';  -- ROBERTO CARLOS ESPARZA  [NOMINA MCDENTAL f101: DR. ROBERTO CARLOS ESPARZA]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'e3735846-2662-47ea-b5e4-139be638afb8';  -- ROSA CECILIA FLORES REYES  [NOMINA MCDENTAL f76: DRA. ROSA CECILIA FLORES REYES]
update public.usuarios set sueldo_semanal = 4500.00 where id = '7f19c542-c134-4fe6-a78b-08eef4e98c97';  -- ROSARIO ORNELAS  [NOMINA MCDENTAL f132: DRA. ROSARIO ORNELAS]
update public.usuarios set sueldo_semanal = 3500.00 where id = 'b7d30cf0-c3f5-4857-8872-4b52c82ffc7a';  -- RUBEN FONSECA SORIANO  [NOMINA MCDENTAL f102: DR RUBEN OMAR FONSECA  SORIANO]
update public.usuarios set sueldo_semanal = 3500.00 where id = '6bf54675-8902-4a6d-95f1-4695225cec05';  -- SAMANTHA PEREZ CARREÑO  [ADMINISTRATIVO f16: SAMANTA PEREZ CARREÑO]
update public.usuarios set sueldo_semanal = 2300.00 where id = 'f8ef695d-264e-4d58-a791-49b09ca6e213';  -- SAN JUANA MARIBEL HERNANDEZ DE LEON  [NOMINA MCDENTAL f17: SAN JUANA MARIBEL HERNANDEZ DE LEON]
update public.usuarios set sueldo_semanal = 3000.00 where id = '4d4a8635-7890-4ae6-b077-5cf288eeaeaa';  -- SANDRA ESMERALDA GARCIA MELENDRES  [NOMINA MCDENTAL f115: DRA SANDRA ESMERALDA GARCIA MELENDRES]
update public.usuarios set sueldo_semanal = 2500.00 where id = '143ed833-c65b-4393-b27e-88e7775adc34';  -- SANDRA LETICIA GALVAN  [ADMINISTRATIVO f22: SANDRA LETICIA GALVAN]
update public.usuarios set sueldo_semanal = 2800.00 where id = 'fa2b77fe-32f2-4117-a48a-0b16a6d6828c';  -- SANDRA RUBI CERVANTES MORALES  [NOMINA MCDENTAL f41: DRA. SANDRA RUBI CERVANTES MORALES]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'c96c0569-85c3-4acf-a16d-765a308b6eb1';  -- SHEILA KARINE GONZALEZ  [NOMINA MCDENTAL f18: DRA. SHEILA KARINE GONZALEZ]
update public.usuarios set sueldo_semanal = 2350.00 where id = '5615b5bc-d079-4651-92f0-41ecbeb60e96';  -- SUGEY RUBI ALVARADO ESCOBAR  [NOMINA MCDENTAL f32: RECEP. SUGEY RUBI ALVARADO ESCOBAR]
update public.usuarios set sueldo_semanal = 3000.00 where id = 'c7e761d5-4430-440a-81b3-7b8eafe20a58';  -- THANIA VIANEY DURAN RODRIGUEZ  [NOMINA MCDENTAL f69: DRA.THANIA VIANEY DURAN RODRIGUEZ]
update public.usuarios set sueldo_semanal = 2500.00 where id = 'fef34520-ed3c-486c-b683-201ffcb98e85';  -- VALERIA TERESA ALCARAZ GARCÍA  [NOMINA MCDENTAL f4: DRA. VALERIA TERESA ALCARAZ GARCÍA]
update public.usuarios set sueldo_semanal = 2700.00 where id = '9cd71e1a-04ec-441a-90e5-ef12ccb5014c';  -- VANESSA AGUILAR AVILLA  [NOMINA MCDENTAL f70: DRA. VANESSA AGUILAR AVILLA]
update public.usuarios set sueldo_semanal = 2350.00 where id = 'ec9471f3-46fd-40b4-87a9-51372ce10dba';  -- VERONICA RODRIGUEZ  [NOMINA MCDENTAL f71: RECEP. VERONICA RODRIGUEZ]
update public.usuarios set sueldo_semanal = 2700.00 where id = '178d6488-2623-4cc0-ae16-387fc24b3596';  -- VICTOR EDUARDO RIVERA FLORES  [NOMINA MCDENTAL f119: DR VICTOR EDUARDO RIVERA FLORES]
update public.usuarios set sueldo_semanal = 2700.00 where id = 'c784bb05-7512-4cf8-a719-b29a7a3a4832';  -- WENDY ALONSO  [NOMINA MCDENTAL f20: DRA WENDY JAILIN ALONSO MOTAS]
update public.usuarios set sueldo_semanal = 2350.00 where id = '550c5a41-97ec-437b-830a-dd802a740f45';  -- XOCHILTH VERONICA DEL TORO DE LA CRUZ  [NOMINA MCDENTAL f40: RECEP. XOCHILTH VERONICA DEL TORO DE LA CRUZ]
update public.usuarios set sueldo_semanal = 2350.00 where id = '39a94f08-6801-4373-ab2c-fb0d3c3fca04';  -- YAMILETH REYES MAR  [NOMINA MCDENTAL f57: RECEP. YAMILETH REYES MAR]
update public.usuarios set sueldo_semanal = 0 where id = '1deb8f90-d2ac-473b-a8b1-2466354f0cc9';  -- MARIA COVARRUVIAS TORRES  [ADMINISTRATIVO f13: importe 'G83' = otra empresa, decision del dueno]

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACION:
--   select count(*) filter (where sueldo_semanal is not null) as con_sueldo,
--          count(*) filter (where sueldo_semanal is null)     as sin_capturar,
--          sum(sueldo_semanal)                                as suma_semanal
--     from public.usuarios where archivado = false;
--
-- ROLLBACK (deja todo como antes: nadie tenia sueldo cargado):
--   update public.usuarios set sueldo_semanal = null where archivado = false;
-- ----------------------------------------------------------------------------
