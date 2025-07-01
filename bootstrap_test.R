library(gamlss)
library(ggplot2)
library(emmeans)
library(boot)
library(jsonlite)

df <- read.csv('data/cleaned_airline.csv')

model_gamlss <- gamlss(price ~ class + stops + class:stops, 
                family = NO(), data = df)
model <- lm(price ~ class + stops + class:stops, data = df)

em <- emmeans(model, ~ stops*class)
eff_size(em, sigma = sigma(model), edf = df.residual(model))

# Estimate marginal means (separate by one factor at a time, as opposed to the above)
em <- emmeans(model, ~ stops | class)
as.data.frame(summary(eff_size(em, sigma = sigma(model), edf = df.residual(model))))
es <- eff_size(em, sigma = sigma(model), edf = df.residual(model)) %>% as.data.frame()

#test_by_factor <- pairs(em, simple = "stops")
#test_by_factor <- as.data.frame(summary(test_by_factor))

get_eff_size <- function(data, indices, model_formula, emmeans_formula, contrast_label) {
  d <- data[indices, ]
  
  tryCatch({
    m <- lm(formula = model_formula, data = d)
    #m$call$data <- quote(data) # Prevent emmeans from looking for 'd' (basically preventing error)-- only for gamlss
    
    em <- emmeans(m, specs = emmeans_formula)
    es <- eff_size(em, sigma = sigma(m), edf = df.residual(m)) %>% as.data.frame()
    
    # Return effect size for matching contrast
    value <- es$effect.size[es$contrast == contrast_label]
    
    # Handle case where contrast isn't found
    if (length(value) == 0) return(NA) else return(value)

    #return(es$effect.size[1])
  }, error = function(e) {
    return(NA)  # return NA if model or emmeans fails
  })
}



model_formula <- price ~ class + stops + class:stops
emmeans_formula <- ~ factor(stops) | factor(class)
target_contrast <- "one - two_or_more"


boot_out <- boot(
  data = df,
  statistic = get_eff_size,
  R = 100,
  model_formula = model_formula,
  emmeans_formula = emmeans_formula,
  contrast_label = target_contrast
)

effect_vector <- as.vector(boot_out$t[!is.na(boot_out$t[, 1]), 1])

