  //Pagination
  pageSize = 7;
  incremSlide = 5;
  startPage = 0;
  numberPage = 0;
  
  
  var pageCount =  $(".line-content").length / pageSize;
  var totalSlidepPage = Math.floor(pageCount / incremSlide);
      
  for(var i = 0 ; i<pageCount;i++){
      $("#pagin").append('<li><a href="#ancla-recurso">'+(i+1)+'</a></li> ');
      if(i>pageSize){
         $("#pagin li").eq(i).hide();
      }
  }
  
  var prev = $("<li/>").addClass("prev").attr('id', 'prev').html("Anterior").click(function(){

    var actual = document.getElementsByClassName('current');   
    for (var i = 0; i < actual.length; i++) {
            var currency = actual[i].innerText;
            console.log("currency: " + currency);
            i = parseInt(currency) - 1;
            console.log(i + 'esta es la pagina a cargar de anterior ');
            $("#pagin li a").eq(i).removeClass("current");
            $("#pagin li a").eq(i).css({"color": '#000000'});
            showPage(i);
            $("#pagin li a").eq(i-1).css({"color": '#3595E0'});
            $("#pagin li a").eq(i-1).addClass("current");

            /*if (i < ($('.line-content').length)/7) {
              showPage(++i);
            }*/
          }

 
  });
  
  prev.show();
  
  var next = $("<li/>").addClass("next").html("Siguiente").click(function(){
    var actual = document.getElementsByClassName('current');

    for (var i = 0; i < actual.length; i++) {
            var currency = actual[i].innerText;
            console.log("currency: " + currency);
            i = parseInt(currency) + 1;
            console.log(i + 'esta es la pagina a cargar');
            $("#pagin li a").eq(i-2).removeClass("current");
            $("#pagin li a").eq(i-2).css({"color": '#000000'});
            showPage(i);
            $("#pagin li a").eq(i-1).css({"color": '#3595E0'});
            $("#pagin li a").eq(i-1).addClass("current");

            /*if (i < ($('.line-content').length)/7) {
              showPage(++i);
            }*/
          }

  });
  
  $("#pagin").prepend(prev).append(next);
  
  $("#pagin li").first().find("a").addClass("current");
  


  slide = function(sens){
     $("#pagin li").hide();
     
     for(t=startPage;t<incremSlide;t++){
       $("#pagin li").eq(t+1).show();
     }
     if(startPage == 0){
       next.show();
       prev.show();
     }else if(numberPage == totalSlidepPage ){
       next.hide();
       prev.show();
     }else{
       next.show();
       prev.show();
     }           
  }
  
  i = 1;
  showPage = function(page) {
      $(".line-content").hide();
      $(".line-content").each(function(n) {
          if (n >= pageSize * (page - 1) && n < pageSize * page)
              $(this).show();
      });        
  }
      
  showPage(i);

  $("#pagin li a").eq(0).css({"color": '#3595E0'});
  $("#pagin li a").eq(0).addClass("current");
  
  $("#pagin li a").click(function() {
    $("#pagin li a").css({"color": '#000000'});
    $(this).css({"color": '#3595E0'});

    $(this).siblings("#pagin li a").css({"color": 'red'});
    $("#pagin li a").removeClass("current");
    $(this).addClass("current");
        showPage(parseInt($(this).text()));
    
  });
  
  actual = document.getElementsByClassName('current')
  
  
