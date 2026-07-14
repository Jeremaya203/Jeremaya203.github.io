var web_service = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/";
var loading;



$(function(){
    $('body').on('click', '.Que-es', function() {
        
        $(this).addClass('Que-es-clic');
        
        var elemento = document.getElementById('Que-es-id');
        elemento.innerHTML = '<h1>Bienvenidos</h1>'+'<p>Estamos en la Ruta del POT: Una guía para tomar la dirección adecuada. Este es espacio para que los municipios tengan un apoyo para realizar los procesos de revisión, ajuste o elaboración de su Plan de Ordenamiento Territorial – POT. Es el resultado de un proceso minucioso de que busca dar respuestas a los municipios sobre posibles obstáculos y dificultades que se encontrarán en el proceso. Siendo así, esta ruta busca dar la información y el acompañamiento necesario, en el momento oportuno, para que los municipios puedan sortear los retos que se van presentando en las diferentes etapas. </p>'
        +'<p>Lo primero, es identificar en qué estado de avance se encuentran y hacerse las siguientes preguntas: ¿Dónde estamos parados? ¿Qué camino hemos recorrido? Y, mirar hacia adelante para entender ¿Cuánto nos falta por recorrer y qué debemos hacer para recorrerlo de la manera más adecuada? Sigan las señales, hagan los altos en el camino, estén atentos a las alertas para llegar a la meta.</p>'
        +'<p>Prendan todos los motores.  </p>'
        + '<button class="entendido">Entendido</button>';
        //document.getElementById("image-home").style.marginTop = "90px";

    });
});


$(function(){
    $('body').on('click', '.Que-es-clic', function() {
        $(this).removeClass('Que-es-clic');
        var elemento = document.getElementById('Que-es-id');
        elemento.innerHTML = '<span class="Que-es-texto">¿Qué es la Ruta del POT?</span>'

    });
});


    //$('th').connections();
    


//function myFunction()
//{
//    document.getElementById('circle0').setAttribute("class", "circle0clic");
//}

//function select(this)
//{
//    document.getElementById('circle').setAttribute("class", "circleclic");
//    document.getElementById('paso').setAttribute("class", "pasoclic");
//}

//function select(el) {
//    el.classList.toggle("optionSelected");
//}


$(function() {
    $('.paso').click(function() {
        var clasecirculo = $(this).find('div').first();
        var clasename = clasecirculo.attr('class');
        var clasepaso = $(this).attr('class');
        var numeropasos = $('.paso').length
        var el = [...document.getElementsByClassName("paso")];
        //document.getElementById("circle0").style.background = "#D38424";
        document.getElementById("paso0").style.border = "1px solid gray";
        

        var test = function(el) {
            console.log(el);
            var clasecirculo = $(el).find('div').first();
            var clasename = clasecirculo.attr('class');
            var ident = clasecirculo.attr('id');
            
            if ($(el).hasClass('pasoclic') && clasename == 'circle circleclic')
            {
                console.log('Tiene la clase mk ' + clasename)
                console.log('Tiene el id ' + ident)
                $(el).addClass('pasoclicked')
                $(clasecirculo).addClass('circleclicked');
                /*document.querySelector(ident).innerText = 'x';*/
                document.getElementById(ident).innerHTML= '&#10003;';

               

            }
            else if (clasename == 'circle circleclic')
            {
                console.log("YO cre que si puedo cambiar la clase del circulo")
            }
        }
        el.forEach(test);
            

        
        
    });

});

$(function() {
  $('.mapa-paso').click(function() {
      var clasemapapaso = $(this).attr('id');
      //document.getElementById("circle0").style.background = "#D38424";
      document.getElementById("paso0").style.border = "1px solid gray";
      if (clasemapapaso == 'mapa-paso-1')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_1');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }

      else if (clasemapapaso == 'mapa-paso-2')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_2');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-3')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_3');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-4')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_4');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-5')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_5');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-6')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_6');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-7')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_7');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-8')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_8');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }
      else if (clasemapapaso == 'mapa-paso-9')
      {
        console.log(clasemapapaso)
        var paso = document.getElementById('paso_9');   
        var clasecirculo = $(paso).find('div').first();
        var clasename = clasecirculo.attr('class');
        $(paso).addClass('pasoclic')
        $(clasecirculo).addClass('circleclic')

      }

      else
      {
              console.log("YO cre que si puedo cambiar la clase del circulo")
      }          
      
  });

});



/*Con esta funcion cambia el color en el primer clic*/


$(function() {
    $('.paso').click(function() {
        var clasecirculo = $(this).find('div').first();
        var clasename = clasecirculo.attr('class');
        var clasepaso = $(this).attr('class');
        document.getElementById("paso0").style.border = "1px solid gray";
        var numeropasos = $('.paso').length
        //var notasdiv = $('.notas')            
        //notasdiv.css({"width": "25%"});
        document.getElementById("notas").style.height = "fit-content";
        document.getElementById("notas").style.width = "33.33%";
        document.getElementById("notas").style.float = "right";
        //document.getElementById("notas").style.marginTop = "-840.67px";
        //document.getElementById("notas").style.backgroundColor = "red";
        document.getElementById("containertarjetas").style.width = "66.67%";
        //document.getElementById("super-container").style.width = "50%";
        if (clasepaso == 'paso')
        {
            console.log('esta es la clase del paso: ' + clasepaso);
            console.log('esta es la clase del circulo ' + clasename);
            console.log('El numero de pasos son: ' + +numeropasos);
            $(clasecirculo).addClass('circleclic');
            $(this).addClass('pasoclic');
            console.log("Encontre que tiene clase paso y voy a ponerlo azul")
            console.log("Esta es la clase de las notas" + notas)
            
            //document.getElementById("containertarjetas").innerHTML = "Paso2.html";
            //$("#containertarjetas").load("Paso2.html");
            //$("#notas").load("Notas2.html");
            //$.get("pasos/Paso2.html", {},
            //function (returnedHtml) {
            //    $("#containertarjetas").html(returnedHtml);
            //});
            //$.get( "Paso8.html", function( data ) {
            //    $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
            //  });
            
            
          }
        else if (clasepaso == 'paso pasoclic')
        {
            console.log("Parece que si uso el hasclass y tiene la clase pasoclic")
            /*var clasepasoclic = $(this).attr('class');*/
            console.log(clasepasoclic);
            /*$(this).addClass('pasoclicked');*/

        }
        else
          {  
              console.log('No encontre esa clase');            
          }
    });

});

/* Funcion para actulizar el contenido*/

$(function(){
    $('body').on('click', '.paso', function() {
        var idpaso = $(this).attr('id');
        console.log('logro obtener el id para cargar el contenido ' + idpaso);
        if(idpaso == 'paso_1')
        {
            $.get( "Paso1.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas1.html", function(data){
                $(".notas").html(data);
            });
    

        }
        else if (idpaso == 'paso_2')
        {
            $.get( "Paso2.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas2.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_3')
        {
            $.get( "Paso3.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                
                //alert( "Load was performed." );
              });
              $.get("Notas3.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_4')
        {
            $.get( "Paso4.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas4.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_5')
        {
            $.get( "Paso5.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas5.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_6')
        {
            $.get( "Paso6.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas6.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_7')
        {
            $.get( "Paso7.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas7.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_8')
        {
            $.get( "Paso8.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas8.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'paso_9')
        {
            $.get( "Paso9.html", function( data ) {
                $( ".containertarjetas" ).html( data );

                //alert( "Load was performed." );
              });
            $.get("Notas9.html", function(data){
                $(".notas").html(data);
            });

        }
        else
        {
            console.log("---")

        }
        
      });

});


/* fin de la funcion que cambia el color en el primer clic*/




$(function(){
    $('body').on('click', '.mapa-paso', function() {
        var idpaso = $(this).attr('id');
        console.log('logro obtener el id para cargar el contenido ' + idpaso);
        document.getElementById("notas").style.height = "fit-content";
        document.getElementById("notas").style.width = "33.33%";
        document.getElementById("notas").style.float = "right";
        //document.getElementById("notas").style.marginTop = "-840.67px";
        //document.getElementById("notas").style.backgroundColor = "red";
        document.getElementById("containertarjetas").style.width = "66.67%";
        if(idpaso == 'mapa-paso-1')
        {
            $.get( "Paso1.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas1.html", function(data){
                $(".notas").html(data);
            });
    

        }
        else if (idpaso == 'mapa-paso-2')
        {
            $.get( "Paso2.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas2.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-3')
        {
            $.get( "Paso3.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas3.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-4')
        {
            $.get( "Paso4.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas4.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-5')
        {
            $.get( "Paso5.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas5.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-6')
        {
            $.get( "Paso6.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas6.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-7')
        {
            $.get( "Paso7.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas7.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-8')
        {
            $.get( "Paso8.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas8.html", function(data){
                $(".notas").html(data);
            });

        }
        else if (idpaso == 'mapa-paso-9')
        {
            $.get( "Paso9.html", function( data ) {
                $( ".containertarjetas" ).html( data );

                //alert( "Load was performed." );
              });
            $.get("Notas9.html", function(data){
                $(".notas").html(data);
            });

        }
        else
        {
            console.log("---")

        }
    });
});


$(function(){
    $('body').on('click', '.boton_next', function() {
        var idpaso = $(this).attr('id');
        console.log('logro obtener el id para cargar el contenido ' + idpaso);
        //document.getElementById("notas").style.height = "100%";
        //document.getElementById("notas").style.width = "25%";
        
        if(idpaso == 'next-paso-2')
        {
          var paso = document.getElementById('paso_2');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_1');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso2.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas2.html", function(data){
                $(".notas").html(data);
            });


        }
        if(idpaso == 'next-paso-3')
        {
          var paso = document.getElementById('paso_3');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_2');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso3.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas3.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-4')
        {
          var paso = document.getElementById('paso_4');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_3');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso4.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas4.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-5')
        {
          var paso = document.getElementById('paso_5');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_4');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso5.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas5.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-6')
        {
          var paso = document.getElementById('paso_6');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_5');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso6.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas6.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-7')
        {
          var paso = document.getElementById('paso_7');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_6');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso7.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas7.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-8')
        {
          var paso = document.getElementById('paso_8');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_7');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso8.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas8.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'next-paso-9')
        {
          var paso = document.getElementById('paso_9');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_8');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso9.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas9.html", function(data){
                $(".notas").html(data);
            });
        }
        else
        {
            console.log('No llegue boton next')
        }


    });
});



$(function(){
    $('body').on('click', '.boton_back', function() {
        var idpaso = $(this).attr('id');
        console.log('logro obtener el id para cargar el contenido ' + idpaso);
        document.getElementById("notas").style.height = "100%";
        document.getElementById("notas").style.width = "25%";
        if(idpaso == 'back-paso-1')
        {
          var paso = document.getElementById('paso_1');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_2');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso1.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas1.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-2')
        {
          var paso = document.getElementById('paso_2');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_3');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso2.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas2.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-3')
        {
          var paso = document.getElementById('paso_3');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_4');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso3.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas3.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-4')
        {
          var paso = document.getElementById('paso_4');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_5');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso4.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas4.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-5')
        {
          var paso = document.getElementById('paso_5');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_6');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso5.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas5.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-6')
        {
          var paso = document.getElementById('paso_6');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_7');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso6.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas6.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-7')
        {
          var paso = document.getElementById('paso_7');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_8');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso7.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas7.html", function(data){
                $(".notas").html(data);
            });
        }
        if(idpaso == 'back-paso-8')
        {
          var paso = document.getElementById('paso_8');   
          var clasecirculo = $(paso).find('div').first();
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclic')
          $(clasecirculo).addClass('circleclic')

          var paso = document.getElementById('paso_9');   
          var clasecirculo = $(paso).find('div').first();
          var ident = clasecirculo.attr('id');
          var clasename = clasecirculo.attr('class');
          $(paso).addClass('pasoclicked')
          $(clasecirculo).addClass('circleclicked')
          document.getElementById(ident).innerHTML= '&#10003;';

            $.get( "Paso8.html", function( data ) {
                $( ".containertarjetas" ).html( data );
                //alert( "Load was performed." );
              });
              $.get("Notas8.html", function(data){
                $(".notas").html(data);
            });
        }
        else
        {
            console.log('No llegue boton back')
        }


    });
});


$(function(){
    $('body').on('click', '.more', function() {
        // cambiar la visibilidad de complete
    $(".complete").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});


$(function(){
    $('body').on('click', '.more-5', function() {
        // cambiar la visibilidad de complete
    $(".complete-5").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-7', function() {
        // cambiar la visibilidad de complete
    $(".complete-7").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-9', function() {
        // cambiar la visibilidad de complete
    $(".complete-9").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-10', function() {
        // cambiar la visibilidad de complete
    $(".complete-10").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-16', function() {
        // cambiar la visibilidad de complete
    $(".complete-16").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-17', function() {
        // cambiar la visibilidad de complete
    $(".complete-17").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer mas");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-18', function() {
        // cambiar la visibilidad de complete
    $(".complete-18").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-19', function() {
        // cambiar la visibilidad de complete
    $(".complete-19").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-20', function() {
        // cambiar la visibilidad de complete
    $(".complete-20").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-21', function() {
        // cambiar la visibilidad de complete
    $(".complete-21").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-22', function() {
        // cambiar la visibilidad de complete
    $(".complete-22").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-26', function() {
        // cambiar la visibilidad de complete
    $(".complete-26").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-27', function() {
        // cambiar la visibilidad de complete
    $(".complete-27").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-29', function() {
        // cambiar la visibilidad de complete
    $(".complete-29").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-31', function() {
        // cambiar la visibilidad de complete
    $(".complete-31").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-33', function() {
        // cambiar la visibilidad de complete
    $(".complete-33").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-34', function() {
        // cambiar la visibilidad de complete
    $(".complete-34").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-35', function() {
        // cambiar la visibilidad de complete
    $(".complete-35").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-38', function() {
        // cambiar la visibilidad de complete
    $(".complete-38").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-39', function() {
        // cambiar la visibilidad de complete
    $(".complete-39").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-41', function() {
        // cambiar la visibilidad de complete
    $(".complete-41").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-42', function() {
        // cambiar la visibilidad de complete
    $(".complete-42").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-43', function() {
        // cambiar la visibilidad de complete
    $(".complete-43").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-44', function() {
        // cambiar la visibilidad de complete
    $(".complete-44").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-45', function() {
        // cambiar la visibilidad de complete
    $(".complete-45").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-46', function() {
        // cambiar la visibilidad de complete
    $(".complete-46").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-47', function() {
        // cambiar la visibilidad de complete
    $(".complete-47").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-48', function() {
        // cambiar la visibilidad de complete
    $(".complete-48").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-49', function() {
        // cambiar la visibilidad de complete
    $(".complete-49").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-50', function() {
        // cambiar la visibilidad de complete
    $(".complete-50").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-51', function() {
        // cambiar la visibilidad de complete
    $(".complete-51").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-52', function() {
        // cambiar la visibilidad de complete
    $(".complete-52").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-53', function() {
        // cambiar la visibilidad de complete
    $(".complete-53").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-59', function() {
        // cambiar la visibilidad de complete
    $(".complete-59").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-67', function() {
        // cambiar la visibilidad de complete
    $(".complete-67").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});

$(function(){
    $('body').on('click', '.more-69', function() {
        // cambiar la visibilidad de complete
    $(".complete-69").toggle();

    // cambiar el texto del boton dependiendo del texto actual
    if ($(this).text() == "Leer menos") {
      $(this).text("Leer más");
    } else {
      $(this).text("Leer menos");
    }
        
    });
});




$(function() {
  $('body').on('click', '.tarjeta', function() {
    console.log('Soy la función de la linea de relación')
    $('.section2').removeClass('section2');
    $(this).addClass('section2');
    $(this).siblings('div').css({"opacity": 0.2});
    var notarel = $(this).find('h3');
    var clasenotarel = notarel.attr('class');
    var idnotarel = notarel.attr('id');

    var idtarjetarel = $(this).attr('id');
    console.log('Soy el id de la tarjeta a relacionar: ' + idtarjetarel);
    if(idtarjetarel == 'tarjeta_6')      
    {
      $('#tarjeta_6, #nota_1').connections();
      var notarelacionada = $('#nota_1');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_7')
    {
      $('#tarjeta_7, #nota_2').connections();
      var notarelacionada = $('#nota_2');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_8')
    {
      $('#tarjeta_8, #nota_2').connections();
      var notarelacionada = $('#nota_2');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_9')
    {
      $('#tarjeta_9, #nota_2').connections();
      $('#tarjeta_9, #nota_3').connections();
    }
    else if(idtarjetarel == 'tarjeta_10')
    {
      $('#tarjeta_10, #nota_4').connections()
      var notarelacionada = $('#nota_4');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_12')
    {
      $('#tarjeta_12, #nota_5').connections()
      var notarelacionada = $('#nota_5');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_13')
    {
      $('#tarjeta_13, #nota_6').connections()
      var notarelacionada = $('#nota_6');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_18')
    {
      $('#tarjeta_18, #nota_7').connections()
      var notarelacionada = $('#nota_7');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_19')
    {
      $('#tarjeta_19, #nota_7').connections()
      $('#tarjeta_19, #nota_8').connections()
    }
    else if(idtarjetarel == 'tarjeta_26')
    {
      $('#tarjeta_26, #nota_9').connections()
      var notarelacionada = $('#nota_9');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_28')
    {
      $('#tarjeta_28, #nota_9').connections()
      var notarelacionada = $('#nota_9');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_23')
    {
      $('#tarjeta_23, #nota_10').connections()
      var notarelacionada = $('#nota_10');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_37')
    {
      $('#tarjeta_37, #nota_11').connections()
      var notarelacionada = $('#nota_11');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_30')
    {
      $('#tarjeta_30, #nota_12').connections()
      var notarelacionada = $('#nota_12');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_32')
    {
      $('#tarjeta_32, #nota_12').connections()
      var notarelacionada = $('#nota_12');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_36')
    {
      $('#tarjeta_36, #nota_12').connections()
      var notarelacionada = $('#nota_12');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_40')
    {
      $('#tarjeta_40, #nota_12').connections()
      var notarelacionada = $('#nota_12');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_42')
    {
      $('#tarjeta_42, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_44')
    {
      $('#tarjeta_44, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_48')
    {
      $('#tarjeta_48, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_50')
    {
      $('#tarjeta_50, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_52')
    {
      $('#tarjeta_52, #nota_14').connections()
      var notarelacionada = $('#nota_14');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_43')
    {
      $('#tarjeta_43, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_45')
    {
      $('#tarjeta_45, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_47')
    {
      $('#tarjeta_47, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_49')
    {
      $('#tarjeta_49, #nota_13').connections()
      var notarelacionada = $('#nota_13');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_51')
    {
      $('#tarjeta_51, #nota_14').connections()
      var notarelacionada = $('#nota_14');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_58')
    {
      $('#tarjeta_58, #nota_15').connections()
      var notarelacionada = $('#nota_15');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_59')
    {
      $('#tarjeta_59, #nota_15').connections()
      $('#tarjeta_59, #nota_16').connections()
    }
    else if(idtarjetarel == 'tarjeta_68')
    {
      $('#tarjeta_68, #nota_17').connections()
      var notarelacionada = $('#nota_17');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
    else if(idtarjetarel == 'tarjeta_67')
    {
      $('#tarjeta_67, #nota_17').connections()
      $('#tarjeta_67, #nota_19').connections()
      document.getElementById("nota_18").style.opacity = "0.2";
      document.getElementById("nota_20").style.opacity = "0.2";
    }
    else if(idtarjetarel == 'tarjeta_69')
    {
      $('#tarjeta_69, #nota_20').connections()
      var notarelacionada = $('#nota_20');
      $(notarelacionada).siblings('.nota').css({"opacity": 0.2});
    }
   
    else 
    {
      console.log('No logro dibujar la conexion :(')
    }
  });
    
    $("body").click(function(e) {
          //if (e.target.class == "parenttarjetas" || $(e.target).parents(".parenttarjetas").size()) 
          if (e.target.class == "parenttarjetas" || $(e.target).parents(".parenttarjetas").length)
          {
               //This triggers if you click on them
          }
          else
          {     
               //This triggers if you click outside of them
             $(".container2").css({"background-color": "rgba(0,0,0,0)"});
             $('.tarjeta').css({"opacity": 1});
             $('.nota').css({"opacity": 1});
             $('.section2').removeClass('section2');
             $('#tarjeta_6').connections('remove');
             $('#tarjeta_7').connections('remove');
             $('#tarjeta_8').connections('remove');
             $('#tarjeta_9').connections('remove');
             $('#tarjeta_10').connections('remove');
             $('#tarjeta_12').connections('remove');
             $('#tarjeta_13').connections('remove');
             $('#tarjeta_18').connections('remove');
             $('#tarjeta_19').connections('remove');
             $('#tarjeta_26').connections('remove');
             $('#tarjeta_28').connections('remove');
             $('#tarjeta_23').connections('remove');
             $('#tarjeta_37').connections('remove');
             $('#tarjeta_30').connections('remove');
             $('#tarjeta_32').connections('remove');
             $('#tarjeta_36').connections('remove');
             $('#tarjeta_40').connections('remove');
             $('#tarjeta_42').connections('remove');
             $('#tarjeta_44').connections('remove');
             $('#tarjeta_48').connections('remove');
             $('#tarjeta_50').connections('remove');
             $('#tarjeta_52').connections('remove');
             $('#tarjeta_43').connections('remove');
             $('#tarjeta_45').connections('remove');
             $('#tarjeta_47').connections('remove');
             $('#tarjeta_49').connections('remove');
             $('#tarjeta_51').connections('remove');
             $('#tarjeta_58').connections('remove');
             $('#tarjeta_59').connections('remove');
             $('#tarjeta_68').connections('remove');
             $('#tarjeta_69').connections('remove');
             $('#tarjeta_67').connections('remove');
          }
    });
    
});




//-----------------funcion orginal resaltar nota--------------------------------

/*$(function() {
    $('.tarjeta').click(function() {
      $('.section2').removeClass('section2');
      $(this).addClass('section2');
      $(this).siblings('div').css({"opacity": 0.2});
      //$(".container2").addClass('newcontainer2');
      //$(".container2").css({"background-color": "rgba(0,0,0,0.9)"});
      //$(".container2").css('z-index', 10);
    });
    
    $("body").click(function(e) {
          if (e.target.class == "parenttarjetas" || $(e.target).parents(".parenttarjetas").size()) 
          {
               //This triggers if you click on them
          }
          else
          {     
               //This triggers if you click outside of them
             $(".container2").css({"background-color": "rgba(0,0,0,0)"});
             $('.tarjeta').css({"opacity": 1});
             $('.section2').removeClass('section2');
          }
    });
    
});*/

//$(function() {
//    $('ol.tarjeta').on("click", "li", function(){ 
//     alert($(this).find("li").text());
//    });
//});

